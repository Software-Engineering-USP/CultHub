from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import call, patch

from django.test import TestCase

from catalogo.geocodificacao import INTERVALO, completar_cidades, pendentes
from catalogo.importacao import importar
from catalogo.models import Local, Provedor
from catalogo.tests.test_importacao import (
    AGORA,
    achar,
    eventos_da_fixture,
    simular_photon,
)
from rotas.photon import ErroPhoton

DEPOIS = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)


def criar_local(nome, **campos):
    campos.setdefault("provedor", Provedor.TICKETMASTER)
    campos.setdefault("id_externo", nome)
    campos.setdefault("latitude", Decimal("-23.5"))
    campos.setdefault("longitude", Decimal("-46.6"))
    return Local.objects.create(nome=nome, **campos)


class CompletarCidadesTest(TestCase):
    def setUp(self):
        self.photon = simular_photon(self)

    def test_grava_o_municipio_oficial_e_a_uf_do_photon(self):
        local = criar_local("Casa", estado="SP")
        self.photon.return_value = ("sao paulo", "São Paulo")

        resumo = completar_cidades(AGORA)

        local.refresh_from_db()
        self.assertEqual((local.cidade, local.estado), ("São Paulo", "SP"))
        self.assertEqual(local.geocodificado_em, AGORA)
        self.assertEqual((resumo.conferidos, resumo.descobertos), (1, 1))
        self.photon.assert_called_once_with(-23.5, -46.6)

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
        self.assertEqual((sem_uf.cidade, sem_uf.estado), ("", ""))
        self.assertEqual(sem_uf.geocodificado_em, AGORA)

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
        criar_local("Com cidade", cidade="Santos", estado="SP")
        criar_local("Sem coordenada", latitude=None, longitude=None)
        criar_local("Conferido", geocodificado_em=AGORA)
        criar_local("Em Buenos Aires", pais="AR")
        criar_local("Manual", provedor=Provedor.MANUAL, id_externo="")

        self.assertEqual(list(pendentes()), [pendente])
        self.assertEqual(completar_cidades(DEPOIS).conferidos, 1)
        self.assertEqual(self.photon.call_count, 1)

    def test_espera_entre_as_consultas(self):
        for nome in ("A", "B", "C"):
            criar_local(nome)

        with patch("catalogo.geocodificacao.time.sleep") as espera:
            completar_cidades(AGORA)

        self.assertEqual(espera.call_args_list, [call(INTERVALO)] * 2)

    def test_falha_no_photon_interrompe_e_deixa_o_resto_para_depois(self):
        for nome in ("A", "B", "C"):
            criar_local(nome)
        self.photon.side_effect = [
            ("Santos", "SP"),
            ErroPhoton("Photon respondeu HTTP 429"),
        ]

        resumo = completar_cidades(AGORA)

        self.assertEqual(resumo.falha, "Photon respondeu HTTP 429")
        self.assertEqual((resumo.conferidos, resumo.descobertos), (1, 1))
        self.assertEqual(self.photon.call_count, 2)
        self.assertEqual(Local.objects.filter(cidade="Santos").count(), 1)
        self.assertEqual(pendentes().count(), 2)

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

        local = self.importar_e_geocodificar()

        self.assertEqual(local.cidade, "São Paulo")
        self.assertIsNone(local.geocodificado_em)
        self.photon.assert_not_called()

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

    def test_cidade_vinda_do_ticketmaster_substitui_a_descoberta(self):
        self.importar_e_geocodificar()
        self.venue["city"] = {"name": "Osasco"}

        local = self.importar_e_geocodificar(DEPOIS)

        self.assertEqual((local.cidade, local.estado), ("Osasco", "SP"))
        self.assertIsNone(local.geocodificado_em)

    def test_fora_do_brasil_a_cidade_fica_como_veio(self):
        self.venue["city"] = {"name": "Buenos Aires"}
        self.venue["country"] = {"countryCode": "AR"}

        local = self.importar_e_geocodificar()

        self.assertEqual(local.cidade, "Buenos Aires")
        self.photon.assert_not_called()
