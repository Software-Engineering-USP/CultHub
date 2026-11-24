from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase

from catalogo import geocodificacao
from catalogo.geocodificacao import (
    INTERVALO,
    MAXIMO_ERROS_SEGUIDOS,
    combinar,
    completar_cidades,
    pendentes,
)
from catalogo.importacao import importar
from catalogo.models import Local, Provedor
from catalogo.tests.test_importacao import (
    AGORA,
    achar,
    erro_passageiro,
    eventos_da_fixture,
    simular_photon,
)
from rotas.photon import ErroPhoton
from rotas.transporte import RESPOSTA_INVALIDA, Espacador

DEPOIS = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)


def criar_local(nome, **campos):
    campos.setdefault("provedor", Provedor.TICKETMASTER)
    campos.setdefault("id_externo", nome)
    campos.setdefault("latitude", Decimal("-23.5"))
    campos.setdefault("longitude", Decimal("-46.6"))
    # Como a importação grava: a entrada do Ticketmaster e o resultado.
    campos.setdefault("cidade_informada", campos.get("cidade", ""))
    campos.setdefault("estado_informado", campos.get("estado", ""))
    return Local.objects.create(nome=nome, **campos)


# A regra inteira da cidade/UF dos locais (`combinar`), um caso por
# entrada: nome, depois Ticketmaster (nome oficial ainda sem conferir com
# a UF, UF), Photon (cidade como veio, UF) e o resultado. Os casos com
# nome de lugar já apareceram nos dados reais ou na revisão.
# fmt: off
CASOS_DE_COMBINAR = {
    # Casos reais.
    "Medianeira/PB, Photon dá cidade e estado":
        (("", "PB"), ("Medianeira", "PR"), ("Medianeira", "PR")),
    "Medianeira/PB, Photon dá a cidade sem estado":
        (("", "PB"), ("Medianeira", ""), ("Medianeira", "PR")),
    "Medianeira/PB com a cidade, Photon só dá o estado":
        (("Medianeira", "PB"), ("", "PR"), ("Medianeira", "PR")),
    "Pinheiros sem UF, Photon acha São Paulo":
        (("Pinheiros", ""), ("São Paulo", "SP"), ("São Paulo", "SP")),
    "Pinheiros sem UF, Photon só dá o estado":
        (("Pinheiros", ""), ("", "SP"), ("", "SP")),
    "Pinheiros sem UF, Photon sem resposta (nunca vira ES)":
        (("Pinheiros", ""), ("", ""), ("Pinheiros", "")),
    "Guarulhos no Photon, Ticketmaster diz São Paulo":
        (("São Paulo", "SP"), ("Guarulhos", "SP"), ("Guarulhos", "SP")),
    "Bom Jesus sem UF, Photon dá o estado":
        (("Bom Jesus", ""), ("Bom Jesus", "RS"), ("Bom Jesus", "RS")),
    "Bom Jesus sem UF, Photon sem estado":
        (("Bom Jesus", ""), ("Bom Jesus", ""), ("Bom Jesus", "")),
    "Bom Jesus/RS, Photon sem estado":
        (("Bom Jesus", "RS"), ("Bom Jesus", ""), ("Bom Jesus", "RS")),
    "Bom Jesus no Photon sem estado, Ticketmaster diz SP":
        (("", "SP"), ("Bom Jesus", ""), ("", "SP")),
    # O Photon devolve a própria cidade só em `name` (ver
    # `rotas.photon.buscar_cidade_e_estado`); aqui ela já chega como cidade.
    "Curitiba como a própria cidade no Photon":
        (("", ""), ("Curitiba", "PR"), ("Curitiba", "PR")),
    "Curitiba do Ticketmaster, Photon só dá o estado":
        (("Curitiba", ""), ("", "PR"), ("Curitiba", "PR")),
    # Regras gerais.
    "UF do Photon vale mais que a do Ticketmaster":
        (("", "PB"), ("", "PR"), ("", "PR")),
    "cidade do Photon que não é da UF dele é descartada":
        (("", ""), ("Curitiba", "SP"), ("", "SP")),
    "cidade do Photon descartada, vale a do Ticketmaster":
        (("Santos", ""), ("Curitiba", "SP"), ("Santos", "SP")),
    "cidade do Photon sem acento":
        (("", "SP"), ("sao paulo", ""), ("São Paulo", "SP")),
    "cidade do Photon que não é município":
        (("", "SP"), ("Vila Madalena", ""), ("", "SP")),
    "sem geocodificação vale o Ticketmaster":
        (("Curitiba", "PR"), ("", ""), ("Curitiba", "PR")),
    "sem geocodificação, cidade que não é da UF do Ticketmaster":
        (("Medianeira", "PB"), ("", ""), ("", "PB")),
    "Santos/RJ no Ticketmaster, Photon só dá SP":
        (("Santos", "RJ"), ("", "SP"), ("Santos", "SP")),
    "UF do Ticketmaster em minúsculas":
        (("", "sp"), ("São Paulo", ""), ("São Paulo", "SP")),
    "nada de lugar nenhum":
        (("", ""), ("", ""), ("", "")),
}
# fmt: on


class CombinarTest(SimpleTestCase):
    def test_casos(self):
        for nome, (
            ticketmaster,
            photon,
            esperado,
        ) in CASOS_DE_COMBINAR.items():
            with self.subTest(nome):
                self.assertEqual(combinar(*ticketmaster, *photon), esperado)


class CompletarCidadesTest(TestCase):
    def setUp(self):
        self.photon = simular_photon(self)

    def test_grava_o_municipio_oficial_e_a_uf_do_photon(self):
        local = criar_local("Casa", estado="SP")
        self.photon.return_value = ("sao paulo", "São Paulo")

        resumo = completar_cidades(AGORA)

        local.refresh_from_db()
        self.assertEqual((local.cidade, local.estado), ("São Paulo", "SP"))
        self.assertEqual(
            (local.cidade_geocodificada, local.estado_geocodificado),
            ("sao paulo", "SP"),
        )
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual((resumo.conferidos, resumo.descobertos), (1, 1))
        self.photon.assert_called_once_with(
            -23.5, -46.6, antes_de_tentar=geocodificacao._vez.aguardar
        )

    def test_uf_da_coordenada_corrige_a_do_ticketmaster(self):
        local = criar_local("Auditório CEEP", estado="PB")
        self.photon.return_value = ("Medianeira", "Paraná")

        completar_cidades(AGORA)

        local.refresh_from_db()
        self.assertEqual((local.cidade, local.estado), ("Medianeira", "PR"))

    def test_sem_estado_no_photon_vale_a_uf_do_local(self):
        com_uf = criar_local("Com UF", estado="sp")
        sem_uf = criar_local("Sem UF")
        self.photon.return_value = ("São Paulo", "")

        completar_cidades(AGORA)

        com_uf.refresh_from_db()
        self.assertEqual((com_uf.cidade, com_uf.estado), ("São Paulo", "SP"))
        sem_uf.refresh_from_db()
        # Sem UF nenhuma, a cidade do Photon completa a UF se o nome for
        # de um estado só.
        self.assertEqual((sem_uf.cidade, sem_uf.estado), ("São Paulo", "SP"))
        self.assertEqual(sem_uf.geocodificado_em, AGORA)

    def test_sem_estado_nenhum_cidade_de_varios_estados_fica_sem_uf(self):
        local = criar_local("Bom Jesus")
        self.photon.return_value = ("Bom Jesus", "")

        completar_cidades(AGORA)

        local.refresh_from_db()
        self.assertEqual((local.cidade, local.estado), ("Bom Jesus", ""))

    def test_limite_por_execucao(self):
        for nome in ("A", "B", "C"):
            criar_local(nome)

        resumo = completar_cidades(AGORA, limite=2)

        self.assertEqual(resumo.conferidos, 2)
        self.assertEqual(pendentes().count(), 1)

    def test_cidade_fora_do_ibge_fica_conferida_e_sem_cidade(self):
        casos = {
            "distrito": ("Moema", "São Paulo"),
            "outra UF": ("Curitiba", "São Paulo"),
            "sem cidade": ("", "São Paulo"),
            "fora do Brasil": None,
        }
        for nome, resposta in casos.items():
            with self.subTest(nome):
                local = criar_local(nome, estado="SP")
                self.photon.return_value = resposta

                resumo = completar_cidades(AGORA)

                local.refresh_from_db()
                self.assertEqual((local.cidade, local.estado), ("", "SP"))
                self.assertEqual(local.geocodificado_em, AGORA)
                self.assertEqual(
                    (resumo.conferidos, resumo.descobertos), (1, 0)
                )

    def test_so_consulta_os_pendentes(self):
        pendente = criar_local("Pendente")
        # Com cidade e UF do Ticketmaster também: a coordenada erra menos.
        com_cidade = criar_local("Com cidade", cidade="Santos", estado="SP")
        criar_local("Sem coordenada", latitude=None, longitude=None)
        criar_local("Conferido", geocodificado_em=AGORA)
        criar_local("Em Buenos Aires", pais="AR")
        criar_local("Manual", provedor=Provedor.MANUAL, id_externo="")

        self.assertEqual(set(pendentes()), {pendente, com_cidade})
        self.assertEqual(completar_cidades(DEPOIS).conferidos, 2)
        self.assertEqual(self.photon.call_count, 2)

    def test_espera_entre_as_consultas_mesmo_em_chamadas_separadas(self):
        for nome in ("A", "B", "C"):
            criar_local(nome)
        relogio = [100.0]
        esperas = []
        vez = Espacador(
            INTERVALO,
            float("inf"),
            relogio=lambda: relogio[0],
            dormir=esperas.append,
        )

        def photon(*_coordenada, antes_de_tentar):
            # Uma falha passageira na primeira consulta, com nova tentativa.
            antes_de_tentar()
            if not esperas:
                antes_de_tentar()

        self.photon.side_effect = photon
        with patch("catalogo.geocodificacao._vez", vez):
            completar_cidades(AGORA, limite=2)
            relogio[0] += 0.5
            completar_cidades(AGORA)

        # Nova tentativa e segunda consulta esperam a vez; a terceira, na
        # outra chamada, espera o que faltava.
        self.assertEqual(len(esperas), 3)
        self.assertAlmostEqual(esperas[0], INTERVALO)
        self.assertAlmostEqual(esperas[1], 2 * INTERVALO)
        self.assertAlmostEqual(esperas[2], 3 * INTERVALO - 0.5)

    def test_falha_passageira_interrompe_e_deixa_o_resto_para_depois(self):
        for nome in ("A", "B", "C"):
            criar_local(nome)
        self.photon.side_effect = [
            ("Santos", "SP"),
            erro_passageiro("Photon respondeu HTTP 429"),
        ]

        resumo = completar_cidades(AGORA)

        self.assertEqual(resumo.falha, "Photon respondeu HTTP 429")
        self.assertTrue(resumo.passageira)
        self.assertEqual((resumo.conferidos, resumo.descobertos), (1, 1))
        self.assertEqual(self.photon.call_count, 2)
        self.assertEqual(Local.objects.filter(cidade="Santos").count(), 1)
        self.assertEqual(pendentes().count(), 2)

    def test_erro_de_um_local_pula_so_ele(self):
        for nome in ("A", "B", "C"):
            criar_local(nome)
        self.photon.side_effect = [
            ("Santos", "SP"),
            ErroPhoton("Photon respondeu HTTP 400"),
            ("Santos", "SP"),
        ]

        resumo = completar_cidades(AGORA)

        self.assertEqual(resumo.falha, "")
        self.assertEqual((resumo.conferidos, resumo.descobertos), (2, 2))
        self.assertEqual(len(resumo.com_erro), 1)
        self.assertEqual(
            list(pendentes().values_list("pk", flat=True)), resumo.com_erro
        )

    def test_erros_seguidos_demais_interrompem(self):
        for nome in "ABCDE":
            criar_local(nome)
        self.photon.side_effect = ErroPhoton(RESPOSTA_INVALIDA)

        resumo = completar_cidades(AGORA)

        self.assertEqual(self.photon.call_count, MAXIMO_ERROS_SEGUIDOS)
        self.assertEqual(resumo.falha, RESPOSTA_INVALIDA)
        self.assertFalse(resumo.passageira)
        self.assertEqual(len(resumo.com_erro), MAXIMO_ERROS_SEGUIDOS)
        self.assertEqual(pendentes().count(), 5)

    def test_erros_de_locais_que_ja_falharam_tambem_interrompem(self):
        # Servidor recusando tudo depois que todos falharam uma vez: não
        # consulta a fila inteira de novo.
        for nome in "ABCDE":
            criar_local(nome, geocodificacao_falhou_em=AGORA)
        self.photon.side_effect = ErroPhoton("Photon respondeu HTTP 403")

        resumo = completar_cidades(DEPOIS)

        self.assertEqual(self.photon.call_count, MAXIMO_ERROS_SEGUIDOS)
        self.assertEqual(resumo.falha, "Photon respondeu HTTP 403")

    def test_erros_no_fim_da_fila_nao_contam_como_interrupcao(self):
        criar_local("Bom")
        for nome in "ABC":
            criar_local(nome, geocodificacao_falhou_em=AGORA)

        def photon(latitude, longitude, antes_de_tentar):
            if self.photon.call_count > 1:
                raise ErroPhoton(RESPOSTA_INVALIDA)
            return ("São Paulo", "SP")

        self.photon.side_effect = photon

        resumo = completar_cidades(DEPOIS)

        self.assertEqual(self.photon.call_count, 4)
        self.assertEqual(len(resumo.com_erro), 3)
        self.assertEqual(resumo.falha, "")

    def test_maximo_de_erros_seguidos_por_chamada(self):
        for nome in "ABC":
            criar_local(nome)
        self.photon.side_effect = ErroPhoton(RESPOSTA_INVALIDA)

        resumo = completar_cidades(AGORA, maximo_erros_seguidos=1)

        self.assertEqual(self.photon.call_count, 1)
        self.assertEqual(resumo.falha, RESPOSTA_INVALIDA)

    def test_locais_com_erro_vao_para_o_fim_da_fila(self):
        locais = [criar_local(nome) for nome in "ABCDE"]
        ruins = set(sorted(local.pk for local in locais)[:3])

        def photon(latitude, longitude, antes_de_tentar):
            if consultados[-1] in ruins:
                raise ErroPhoton("Photon respondeu HTTP 400")
            return ("Santos", "SP")

        consultados = []
        original = geocodificacao._consultar

        def consultar(local):
            consultados.append(local.pk)
            return original(local)

        self.photon.side_effect = photon
        with patch("catalogo.geocodificacao._consultar", consultar):
            primeira = completar_cidades(AGORA)
            segunda = completar_cidades(DEPOIS)

        # Na primeira, os 3 ruins do começo param tudo; na segunda, eles
        # ficam por último e os outros são conferidos.
        self.assertEqual(primeira.conferidos, 0)
        self.assertEqual(len(primeira.com_erro), 3)
        self.assertEqual(segunda.conferidos, 2)
        self.assertEqual(
            set(consultados[3:5]),
            {local.pk for local in locais if local.pk not in ruins},
        )
        falhas = Local.objects.filter(pk__in=ruins).values_list(
            "geocodificacao_falhou_em", flat=True
        )
        # Tentados de novo no fim da segunda, ficam com a data dela.
        self.assertEqual(set(falhas), {DEPOIS})

    def test_cidade_sem_uf_ganha_a_uf_do_photon(self):
        local = criar_local("Bom Jesus", cidade="Bom Jesus")
        self.photon.return_value = ("Bom Jesus", "Rio Grande do Sul")

        completar_cidades(AGORA)

        local.refresh_from_db()
        self.assertEqual((local.cidade, local.estado), ("Bom Jesus", "RS"))

    def test_so_sem_erro(self):
        com_erro = criar_local("A", geocodificacao_falhou_em=AGORA)
        sem_erro = criar_local("B")
        self.photon.return_value = ("São Paulo", "SP")

        resumo = completar_cidades(DEPOIS, so_sem_erro=True)

        self.assertEqual(resumo.conferidos, 1)
        self.assertEqual(list(pendentes()), [com_erro])
        sem_erro.refresh_from_db()
        self.assertEqual(sem_erro.geocodificado_em, DEPOIS)

    def test_sem_pendentes_nao_consulta(self):
        resumo = completar_cidades(AGORA)

        self.assertEqual((resumo.conferidos, resumo.falha), (0, ""))
        self.photon.assert_not_called()


class CidadeNaImportacaoTest(TestCase):
    def setUp(self):
        self.photon = simular_photon(self, ("São Paulo", "SP"))
        self.dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        self.venue = self.dados["_embedded"]["venues"][0]

    def local(self):
        return Local.objects.get(
            provedor=Provedor.TICKETMASTER, id_externo=self.venue["id"]
        )

    def importar_e_geocodificar(self, agora=AGORA):
        importar([self.dados], agora)
        completar_cidades(agora)
        return self.local()

    def test_cidade_do_ticketmaster_vira_o_nome_oficial(self):
        self.venue["city"] = {"name": "sao paulo"}
        importar([self.dados], AGORA)

        self.assertEqual(self.local().cidade_informada, "São Paulo")
        self.assertEqual(self.local().cidade, "São Paulo")
        # Mesmo com cidade e UF, a coordenada é conferida uma vez.
        self.assertEqual(list(pendentes()), [self.local()])

    def test_cidade_que_nao_e_da_uf_do_ticketmaster_fica_guardada(self):
        # Caso Medianeira: a cidade não é de PB, mas é da UF do Photon.
        self.venue["city"] = {"name": "Medianeira"}
        self.venue["state"] = {"stateCode": "PB"}
        self.photon.return_value = ("", "Paraná")
        importar([self.dados], AGORA)
        self.assertEqual(
            (self.local().cidade, self.local().estado), ("", "PB")
        )
        self.assertEqual(self.local().cidade_informada, "Medianeira")

        local = self.importar_e_geocodificar()

        self.assertEqual((local.cidade, local.estado), ("Medianeira", "PR"))

    def test_cidade_invalida_do_ticketmaster_e_descartada(self):
        self.venue["city"] = {"name": "Nocity"}
        importar([self.dados], AGORA)

        self.assertEqual(self.local().cidade, "")
        self.assertEqual(list(pendentes()), [self.local()])

    def test_reimportar_mantem_a_cidade_descoberta(self):
        self.importar_e_geocodificar()

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual((local.cidade, local.estado), ("São Paulo", "SP"))
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual(self.photon.call_count, 1)

    def test_reimportar_aceita_uf_nova_quando_o_photon_nao_achou_cidade(self):
        self.venue["state"] = {"stateCode": "PB"}
        self.photon.return_value = None
        self.importar_e_geocodificar()
        self.venue["state"] = {"stateCode": "PR"}

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual((local.cidade, local.estado), ("", "PR"))
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual(self.photon.call_count, 1)

    def test_reimportar_mantem_a_uf_corrigida(self):
        self.photon.return_value = ("Medianeira", "Paraná")
        self.importar_e_geocodificar()

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual((local.cidade, local.estado), ("Medianeira", "PR"))

    def test_coordenada_nova_descobre_a_cidade_de_novo(self):
        self.importar_e_geocodificar()
        self.venue["location"] = {"latitude": "-22.9", "longitude": "-43.2"}
        self.venue["state"] = {"stateCode": "RJ"}
        self.photon.return_value = ("Rio de Janeiro", "Rio de Janeiro")

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual(
            (local.cidade, local.estado), ("Rio de Janeiro", "RJ")
        )
        self.assertEqual(local.geocodificado_em, DEPOIS)

    def test_photon_vale_mais_que_a_cidade_que_o_ticketmaster_manda_depois(
        self,
    ):
        # Caso Guarulhos: com a mesma coordenada, a cidade do Photon fica.
        self.photon.return_value = ("Guarulhos", "SP")
        self.importar_e_geocodificar()
        self.venue["city"] = {"name": "São Paulo"}
        self.venue["state"] = {"stateCode": "SP"}

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual((local.cidade, local.estado), ("Guarulhos", "SP"))
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual(self.photon.call_count, 1)

    def test_coordenada_nova_apaga_a_resposta_do_photon(self):
        self.photon.return_value = ("Guarulhos", "SP")
        self.importar_e_geocodificar()
        self.assertEqual(self.local().cidade_geocodificada, "Guarulhos")
        self.venue["location"] = {"latitude": "-22.9", "longitude": "-43.2"}
        self.venue["city"] = {"name": "Rio de Janeiro"}
        self.venue["state"] = {"stateCode": "RJ"}

        importar([self.dados], DEPOIS)

        local = self.local()
        self.assertIsNone(local.geocodificado_em)
        self.assertEqual(
            (local.cidade_geocodificada, local.estado_geocodificado), ("", "")
        )
        # Sem a resposta antiga, valem os dados novos do Ticketmaster.
        self.assertEqual(
            (local.cidade, local.estado), ("Rio de Janeiro", "RJ")
        )

    def test_cidade_do_ticketmaster_sem_coordenada(self):
        # Sem coordenada, esses locais nunca passariam pelo Photon.
        self.venue["location"] = None
        for estado, cidade, esperado in (
            # UF válida não é trocada: a cidade que não é dela é apagada.
            ({"stateCode": "PB"}, "Medianeira", ("", "PB")),
            ({"stateCode": "SP"}, "Pinheiros", ("", "SP")),
            ({"stateCode": "RJ"}, "Ipanema", ("", "RJ")),
            # O nome nunca completa a UF: pode ser um bairro.
            (None, "Curitiba", ("Curitiba", "")),
            (None, "Pinheiros", ("Pinheiros", "")),
            (None, "Bom Jesus", ("Bom Jesus", "")),
            ({"stateCode": "XX"}, "Nocity", ("", "")),
        ):
            with self.subTest(cidade=cidade):
                self.venue["state"] = estado
                self.venue["city"] = {"name": cidade}

                importar([self.dados], AGORA)

                local = self.local()
                self.assertEqual((local.cidade, local.estado), esperado)

    def test_bairro_com_coordenada_vai_para_o_photon(self):
        self.venue["city"] = {"name": "Pinheiros"}

        local = self.importar_e_geocodificar()

        self.assertEqual((local.cidade, local.estado), ("São Paulo", "SP"))
        self.assertEqual(self.photon.call_count, 1)

    def test_cidade_sem_uf_com_coordenada_vai_para_o_photon(self):
        # Pinheiros só é município no ES, mas este fica em São Paulo.
        for numero, estado in enumerate((None, {"stateCode": "XX"})):
            with self.subTest(estado=estado):
                self.venue["id"] = f"pinheiros{numero}"
                self.venue["city"] = {"name": "Pinheiros"}
                self.venue["state"] = estado
                importar([self.dados], AGORA)
                self.assertEqual(
                    (self.local().cidade, self.local().estado),
                    ("Pinheiros", ""),
                )

                local = self.importar_e_geocodificar()

                self.assertEqual(
                    (local.cidade, local.estado), ("São Paulo", "SP")
                )

    def test_sem_cidade_no_photon_vale_o_palpite_do_ticketmaster(self):
        self.venue["state"] = None
        for numero, (cidade, resposta, esperado) in enumerate(
            (
                # Sem UF de lugar nenhum, o palpite fica sem UF: o nome
                # pode ser de um bairro de outro estado.
                ("Curitiba", None, ("Curitiba", "")),
                ("Pinheiros", None, ("Pinheiros", "")),
                ("Curitiba", ("", "Paraná"), ("Curitiba", "PR")),
                ("Bom Jesus", ("", "Piauí"), ("Bom Jesus", "PI")),
                # O Photon dá a UF, e Pinheiros não é município de SP.
                ("Pinheiros", ("", "São Paulo"), ("", "SP")),
            )
        ):
            with self.subTest(cidade=cidade, resposta=resposta):
                self.venue["id"] = f"palpite{numero}"
                self.venue["city"] = {"name": cidade}
                self.photon.return_value = resposta

                local = self.importar_e_geocodificar()
                self.assertEqual((local.cidade, local.estado), esperado)
                self.assertEqual(local.geocodificado_em, AGORA)

                # A reimportação mantém o que a geocodificação decidiu.
                local = self.importar_e_geocodificar(DEPOIS)
                self.assertEqual((local.cidade, local.estado), esperado)
                self.assertEqual(local.geocodificado_em, AGORA)

    def test_palpite_que_chega_depois_da_geocodificacao(self):
        self.venue["state"] = None
        self.photon.return_value = None
        local = self.importar_e_geocodificar()
        self.assertEqual((local.cidade, local.estado), ("", ""))

        # Combinado com a resposta guardada, sem consultar o Photon de novo.
        self.venue["city"] = {"name": "curitiba"}
        local = self.importar_e_geocodificar(DEPOIS)
        self.assertEqual((local.cidade, local.estado), ("Curitiba", ""))
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual(self.photon.call_count, 1)

    def test_palpite_que_chega_depois_vale_se_for_da_uf_achada(self):
        self.venue["state"] = None
        self.photon.return_value = ("", "Paraná")
        local = self.importar_e_geocodificar()
        self.assertEqual((local.cidade, local.estado), ("", "PR"))

        # Sem nome nem UF no Ticketmaster, fica a UF da geocodificação.
        local = self.importar_e_geocodificar(DEPOIS)
        self.assertEqual((local.cidade, local.estado), ("", "PR"))

        for cidade, esperado in (
            ("Curitiba", ("Curitiba", "PR")),
            ("Pinheiros", ("", "PR")),
        ):
            with self.subTest(cidade=cidade):
                Local.objects.filter(pk=local.pk).update(cidade="")
                self.venue["city"] = {"name": cidade}

                local = self.importar_e_geocodificar(DEPOIS)

                self.assertEqual((local.cidade, local.estado), esperado)
                self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual(self.photon.call_count, 1)

    def test_meia_coordenada_conta_como_sem_coordenada(self):
        self.venue["location"] = {"latitude": "-25.4"}
        self.venue["city"] = {"name": "Curitiba"}
        self.venue["state"] = None

        local = self.importar_e_geocodificar()

        self.assertEqual((local.cidade, local.estado), ("Curitiba", ""))
        self.photon.assert_not_called()

    def test_cidade_de_varios_estados_sem_uf_com_coordenada_vai_para_o_photon(
        self,
    ):
        self.venue["city"] = {"name": "Bom Jesus"}
        self.venue["state"] = None
        self.photon.return_value = ("Bom Jesus", "Rio Grande do Sul")

        local = self.importar_e_geocodificar()
        self.assertEqual((local.cidade, local.estado), ("Bom Jesus", "RS"))

        local = self.importar_e_geocodificar(DEPOIS)
        self.assertEqual((local.cidade, local.estado), ("Bom Jesus", "RS"))
        self.assertEqual(self.photon.call_count, 1)

    def test_erro_no_photon_continua_marcado_ate_a_coordenada_mudar(self):
        self.photon.side_effect = ErroPhoton("Photon respondeu HTTP 400")
        self.importar_e_geocodificar()
        self.assertEqual(self.local().geocodificacao_falhou_em, AGORA)

        importar([self.dados], DEPOIS)
        self.assertEqual(self.local().geocodificacao_falhou_em, AGORA)

        self.venue["location"] = {"latitude": "-22.9", "longitude": "-43.2"}
        importar([self.dados], DEPOIS)
        self.assertIsNone(self.local().geocodificacao_falhou_em)

    def test_venue_sem_location_mantem_coordenada_e_cidade(self):
        self.importar_e_geocodificar()
        del self.venue["location"]

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual((local.cidade, local.estado), ("São Paulo", "SP"))
        self.assertIsNotNone(local.latitude)
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual(self.photon.call_count, 1)

    def test_fora_do_brasil_a_cidade_fica_como_veio(self):
        self.venue["city"] = {"name": "Buenos Aires"}
        self.venue["country"] = {"countryCode": "AR"}

        local = self.importar_e_geocodificar()

        self.assertEqual(local.cidade, "Buenos Aires")
        self.photon.assert_not_called()
