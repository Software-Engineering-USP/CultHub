from datetime import timedelta
from decimal import Decimal
from typing import ClassVar

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from catalogo.filtros import aplicar_filtros, visiveis
from catalogo.models import Evento, FaixaPreco, Local, Provedor
from catalogo.tests.fabrica import criar_evento

PONTO_E_ANTIPODA = ("4.32335", "-35.374447", "-4.32335", "144.625553")


class FiltrosBuscaTest(APITestCase):
    def buscar(self, **params):
        return self.client.get("/api/eventos/", params)

    def titulos(self, **params):
        resposta = self.buscar(**params)
        self.assertEqual(resposta.status_code, 200)
        return sorted(e["titulo"] for e in resposta.json()["results"])

    def test_q_no_titulo_sem_caixa(self):
        criar_evento(titulo="Noite de JAZZ")
        criar_evento(titulo="Outro")
        self.assertEqual(self.titulos(q="jazz"), ["Noite de JAZZ"])

    def test_q_na_descricao(self):
        criar_evento(titulo="A", descricao="Show de Samba")
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(q="samba"), ["A"])

    def test_q_no_nome_do_local(self):
        local = Local.objects.create(
            nome="Teatro Municipal", cidade="São Paulo", estado="SP"
        )
        criar_evento(titulo="A", local=local)
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(q="municipal"), ["A"])

    def test_q_sem_caixa_e_sem_acento(self):
        criar_evento(titulo="Festival em SÃO PAULO")
        criar_evento(titulo="EXPOSIÇÃO de arte")
        criar_evento(titulo="Outro")
        self.assertEqual(
            self.titulos(q="são paulo"), ["Festival em SÃO PAULO"]
        )
        self.assertEqual(
            self.titulos(q="SÃO PAULO"), ["Festival em SÃO PAULO"]
        )
        self.assertEqual(self.titulos(q="exposicao"), ["EXPOSIÇÃO de arte"])

    def test_q_sem_caixa_na_descricao_e_no_local(self):
        local = Local.objects.create(nome="TEATRO ÁGUA", estado="SP")
        criar_evento(titulo="A", descricao="SHOW DE SAMBÃO")
        criar_evento(titulo="B", local=local)
        self.assertEqual(self.titulos(q="sambao"), ["A"])
        self.assertEqual(self.titulos(q="agua"), ["B"])

    def test_q_com_curinga_do_like_e_literal(self):
        criar_evento(titulo="100% bom")
        criar_evento(titulo="Outro")
        self.assertEqual(self.titulos(q="%"), ["100% bom"])

    def test_q_em_branco_sem_filtro(self):
        criar_evento(titulo="A")
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(q="  "), ["A", "B"])

    def test_categorias_ou(self):
        criar_evento(titulo="Musica", categorias=["music"])
        criar_evento(titulo="Arte", categorias=["art"])
        criar_evento(titulo="Teatro", categorias=["theater"])
        self.assertEqual(
            self.titulos(categorias="music,art"), ["Arte", "Musica"]
        )

    def test_categorias_sem_duplicar(self):
        criar_evento(categorias=["music", "festival"])
        corpo = self.buscar(categorias="music,festival").json()
        self.assertEqual(corpo["count"], 1)
        self.assertEqual(len(corpo["results"]), 1)

    def test_categorias_sem_codigo_nao_filtram(self):
        criar_evento(titulo="Musica", categorias=["music"])
        criar_evento(titulo="Sem categoria")
        for valor in ("", "  ", ",", " , ,"):
            with self.subTest(valor=valor):
                self.assertEqual(
                    self.titulos(categorias=valor), ["Musica", "Sem categoria"]
                )

    def test_categorias_ignoram_vazios_e_espacos(self):
        criar_evento(titulo="Musica", categorias=["music"])
        criar_evento(titulo="Arte", categorias=["art"])
        criar_evento(titulo="Teatro", categorias=["theater"])
        for valor in ("music,,art", " music , art ", ",music,art,"):
            with self.subTest(valor=valor):
                self.assertEqual(
                    self.titulos(categorias=valor), ["Arte", "Musica"]
                )

    def test_categoria_inexistente_400(self):
        resposta = self.buscar(categorias="music,xyz")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("categorias", resposta.json())

    def test_preco_gratuito(self):
        criar_evento(titulo="Free", gratuito=True)
        criar_evento(titulo="Pago", gratuito=False)
        self.assertEqual(self.titulos(preco="gratuito"), ["Free"])

    def criar_um_de_cada_preco(self):
        criar_evento(titulo="Free", gratuito=True)
        pago = criar_evento(titulo="Pago")
        FaixaPreco.objects.create(evento=pago, minimo=Decimal(50))
        criar_evento(
            titulo="Sem preço",
            provedor=Provedor.TICKETMASTER,
            id_externo="tm-1",
        )

    def test_preco_pago_exclui_sem_preco_informado(self):
        self.criar_um_de_cada_preco()
        self.assertEqual(self.titulos(preco="pago"), ["Pago"])

    def test_preco_desconhecido(self):
        self.criar_um_de_cada_preco()
        self.assertEqual(self.titulos(preco="desconhecido"), ["Sem preço"])

    def test_preco_em_lista_e_ou(self):
        self.criar_um_de_cada_preco()
        self.assertEqual(
            self.titulos(preco="pago,desconhecido"), ["Pago", "Sem preço"]
        )
        self.assertEqual(
            self.titulos(preco=" gratuito , pago "), ["Free", "Pago"]
        )

    def test_preco_lista_sem_valor_nao_filtra(self):
        self.criar_um_de_cada_preco()
        self.assertEqual(
            self.titulos(preco=" , "), ["Free", "Pago", "Sem preço"]
        )

    def test_preco_lista_com_valor_invalido_400(self):
        resposta = self.buscar(preco="pago,caro")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("preco", resposta.json())

    def test_faixa_so_com_maximo_e_paga(self):
        evento = criar_evento(titulo="Até 80")
        FaixaPreco.objects.create(evento=evento, maximo=Decimal(80))
        self.assertEqual(self.titulos(preco="pago"), ["Até 80"])
        self.assertEqual(self.titulos(preco="desconhecido"), [])

    def test_faixa_sem_valor_positivo_e_desconhecida(self):
        sem_valor = criar_evento(titulo="Sem valor")
        FaixaPreco.objects.create(evento=sem_valor)
        zerada = criar_evento(titulo="Zerada")
        FaixaPreco.objects.create(
            evento=zerada, minimo=Decimal(0), maximo=Decimal(0)
        )
        self.assertEqual(self.titulos(preco="pago"), [])
        self.assertEqual(
            self.titulos(preco="desconhecido"), ["Sem valor", "Zerada"]
        )

    def test_gratuito_com_faixa_conta_so_como_gratuito(self):
        evento = criar_evento(titulo="Free", gratuito=True)
        FaixaPreco.objects.create(evento=evento, minimo=Decimal(50))
        self.assertEqual(self.titulos(preco="gratuito"), ["Free"])
        self.assertEqual(self.titulos(preco="pago"), [])
        self.assertEqual(self.titulos(preco="desconhecido"), [])

    def test_varias_faixas_nao_duplicam_o_evento(self):
        evento = criar_evento(titulo="Duas faixas")
        FaixaPreco.objects.create(evento=evento, minimo=Decimal(50))
        FaixaPreco.objects.create(evento=evento, minimo=Decimal(90))
        corpo = self.buscar(preco="pago").json()
        self.assertEqual(corpo["count"], 1)
        self.assertEqual(len(corpo["results"]), 1)

    def test_situacao_preco_na_resposta_bate_com_o_filtro(self):
        self.criar_um_de_cada_preco()
        zerada = criar_evento(titulo="Zerada")
        FaixaPreco.objects.create(evento=zerada, minimo=Decimal(0))
        so_maximo = criar_evento(titulo="Só máximo")
        FaixaPreco.objects.create(evento=so_maximo, maximo=Decimal(80))
        negativa = criar_evento(titulo="Negativa")
        FaixaPreco.objects.create(evento=negativa, minimo=Decimal(-1))
        esperado = {
            "gratuito": ["Free"],
            "pago": ["Pago", "Só máximo"],
            "desconhecido": ["Negativa", "Sem preço", "Zerada"],
        }
        for valor, titulos in esperado.items():
            with self.subTest(preco=valor):
                resultados = self.buscar(preco=valor).json()["results"]
                self.assertEqual(
                    sorted(e["titulo"] for e in resultados), titulos
                )
                self.assertEqual(
                    {e["situacao_preco"] for e in resultados}, {valor}
                )

    def test_preco_invalido_400(self):
        resposta = self.buscar(preco="caro")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("preco", resposta.json())

    def test_preco_vazio_sem_filtro(self):
        criar_evento(titulo="A", gratuito=True)
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(preco=""), ["A", "B"])

    def test_filtros_combinados_com_e(self):
        criar_evento(titulo="Jazz Free", categorias=["music"], gratuito=True)
        criar_evento(titulo="Jazz Pago", categorias=["music"])
        criar_evento(titulo="Jazz Arte", categorias=["art"], gratuito=True)
        criar_evento(titulo="Rock Free", categorias=["music"], gratuito=True)
        self.assertEqual(
            self.titulos(q="jazz", categorias="music", preco="gratuito"),
            ["Jazz Free"],
        )


class FiltroPeriodoTest(APITestCase):
    def setUp(self):
        self.hoje = timezone.localdate()

    def dia(self, n):
        return self.hoje + timedelta(days=n)

    def titulos(self, **params):
        resposta = self.client.get("/api/eventos/", params)
        self.assertEqual(resposta.status_code, 200)
        return sorted(e["titulo"] for e in resposta.json()["results"])

    def criar_tres(self):
        criar_evento(titulo="A", data_inicio=self.dia(2))
        criar_evento(titulo="B", data_inicio=self.dia(10))
        criar_evento(titulo="C", data_inicio=self.dia(20))

    def test_dentro_do_intervalo(self):
        self.criar_tres()
        self.assertEqual(
            self.titulos(
                de=self.dia(5).isoformat(), ate=self.dia(15).isoformat()
            ),
            ["B"],
        )

    def test_bordas_de_de_e_ate_sao_inclusivas(self):
        criar_evento(titulo="Dia 10", data_inicio=self.dia(10))
        dia = self.dia(10).isoformat()
        self.assertEqual(self.titulos(de=dia), ["Dia 10"])
        self.assertEqual(self.titulos(ate=dia), ["Dia 10"])
        self.assertEqual(self.titulos(de=dia, ate=dia), ["Dia 10"])
        self.assertEqual(self.titulos(de=self.dia(11).isoformat()), [])
        self.assertEqual(self.titulos(ate=self.dia(9).isoformat()), [])

    def test_de_na_data_final_de_evento_de_varios_dias(self):
        criar_evento(
            titulo="Festival",
            data_inicio=self.dia(5),
            data_fim=self.dia(10),
        )
        self.assertEqual(
            self.titulos(de=self.dia(10).isoformat()), ["Festival"]
        )
        self.assertEqual(self.titulos(de=self.dia(11).isoformat()), [])

    def test_so_de(self):
        self.criar_tres()
        self.assertEqual(self.titulos(de=self.dia(5).isoformat()), ["B", "C"])

    def test_so_ate(self):
        self.criar_tres()
        self.assertEqual(
            self.titulos(ate=self.dia(10).isoformat()), ["A", "B"]
        )

    def test_evento_de_varios_dias_que_cruza_o_intervalo(self):
        criar_evento(
            titulo="Festival",
            data_inicio=self.dia(1),
            data_fim=self.dia(8),
        )
        criar_evento(titulo="Fora", data_inicio=self.dia(2))
        self.assertEqual(
            self.titulos(
                de=self.dia(6).isoformat(), ate=self.dia(9).isoformat()
            ),
            ["Festival"],
        )

    def test_de_e_ate_vazios_sem_filtro(self):
        resposta = self.client.get("/api/eventos/", {"de": "", "ate": ""})
        self.assertEqual(resposta.status_code, 200)

    def test_data_invalida_400(self):
        resposta = self.client.get("/api/eventos/", {"de": "2026-13-01"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("de", resposta.json())

    def test_de_depois_de_ate_400(self):
        resposta = self.client.get(
            "/api/eventos/",
            {"de": self.dia(5).isoformat(), "ate": self.dia(2).isoformat()},
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("ate", resposta.json())

    def test_data_em_formato_basico_400(self):
        resposta = self.client.get("/api/eventos/", {"de": "20261001"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("de", resposta.json())

    def test_data_em_formato_semana_400(self):
        resposta = self.client.get("/api/eventos/", {"ate": "2026-W01-1"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("ate", resposta.json())


class FiltroDistanciaTest(APITestCase):
    # Av. Paulista (-23.561414, -46.655881); MASP a ~0.2 km;
    # Ibirapuera a ~2.5 km; Rio a ~360 km.
    PAULISTA: ClassVar = {"lat": "-23.561414", "lng": "-46.655881"}

    def evento_em(self, titulo, latitude, longitude):
        local = Local.objects.create(
            nome=titulo,
            cidade="Cidade",
            estado="XX",
            latitude=Decimal(latitude) if latitude else None,
            longitude=Decimal(longitude) if longitude else None,
        )
        return criar_evento(titulo=titulo, local=local)

    def criar_locais(self):
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        self.evento_em("MASP", "-23.561684", "-46.655981")
        self.evento_em("Ibirapuera", "-23.587416", "-46.657634")
        self.evento_em("Rio", "-22.9068", "-43.1729")

    def buscar(self, **params):
        return self.client.get("/api/eventos/", params)

    def test_dentro_do_raio(self):
        self.criar_locais()
        resposta = self.buscar(raio="5", **self.PAULISTA)
        self.assertEqual(resposta.status_code, 200)
        titulos = sorted(e["titulo"] for e in resposta.json()["results"])
        self.assertEqual(titulos, ["Ibirapuera", "MASP", "Paulista"])

    def test_distancia_km_na_resposta(self):
        self.criar_locais()
        resultados = self.buscar(raio="5", **self.PAULISTA).json()["results"]
        ibira = next(e for e in resultados if e["titulo"] == "Ibirapuera")
        self.assertAlmostEqual(ibira["distancia_km"], 2.5, delta=0.5)

    def test_ponto_coincidente(self):
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        resultados = self.buscar(raio="1", **self.PAULISTA).json()["results"]
        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]["distancia_km"], 0.0)

    def test_arredondamento_acima_de_1_nao_perde_o_ponto_coincidente(self):
        # Aqui o cosseno calculado dá 1.0000000000000002 (ACos seria NULL).
        self.evento_em("Coincidente", "-8.26449", "-70.174985")
        resultados = self.buscar(
            lat="-8.26449", lng="-70.174985", raio="1"
        ).json()["results"]
        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]["distancia_km"], 0.0)

    def test_arredondamento_abaixo_de_menos_1_nao_perde_o_antipoda(self):
        # Aqui o cosseno calculado fica abaixo de -1 (ACos seria NULL).
        lat, lng, lat2, lng2 = PONTO_E_ANTIPODA
        self.evento_em("Antípoda", lat2, lng2)
        resultados = self.buscar(lat=lat, lng=lng, raio="20100").json()[
            "results"
        ]
        self.assertEqual(len(resultados), 1)
        self.assertAlmostEqual(resultados[0]["distancia_km"], 20015.1, delta=1)

    def test_sem_coordenada_fica_de_fora(self):
        self.evento_em("Sem coordenada", None, None)
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        resultados = self.buscar(raio="5", **self.PAULISTA).json()["results"]
        self.assertEqual([e["titulo"] for e in resultados], ["Paulista"])

    def test_faltando_parametro_400(self):
        resposta = self.buscar(**self.PAULISTA)
        self.assertEqual(resposta.status_code, 400)
        corpo = resposta.json()
        self.assertIn("non_field_errors", corpo)
        self.assertIn("raio", corpo["non_field_errors"][0])

    def test_trio_vazio_sem_filtro(self):
        self.criar_locais()
        resposta = self.buscar(lat="", lng="", raio="")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(resposta.json()["results"]), 4)

    def test_parcialmente_vazio_400(self):
        resposta = self.buscar(lat="-23.5", lng="", raio="")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("non_field_errors", resposta.json())

    def test_valores_invalidos_400(self):
        casos = [
            ("lat", "abc"),
            ("lat", "95"),
            ("lng", "181"),
            ("raio", "-1"),
            ("raio", "0"),
            ("raio", "nan"),
            ("raio", "inf"),
            ("raio", "-inf"),
            ("lat", "nan"),
            ("lng", "inf"),
        ]
        for parametro, valor in casos:
            with self.subTest(parametro=parametro, valor=valor):
                params = {**self.PAULISTA, "raio": "5", parametro: valor}
                resposta = self.buscar(**params)
                self.assertEqual(resposta.status_code, 400)
                self.assertIn(parametro, resposta.json())

    def test_sem_filtro_distancia_km_null(self):
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        resultados = self.buscar().json()["results"]
        self.assertIsNone(resultados[0]["distancia_km"])


class FiltrosSemColunasExtrasTest(TestCase):
    def test_busca_e_periodo_nao_adicionam_colunas_ao_select(self):
        eventos = aplicar_filtros(
            visiveis(Evento.objects.all(), timezone.now()),
            {"q": "jazz", "de": "2026-01-01"},
        )
        self.assertEqual(list(eventos.query.annotation_select), [])
