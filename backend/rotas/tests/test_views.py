from unittest.mock import patch

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from rotas.photon import ErroPhoton
from rotas.views import ERRO_UPSTREAM

URL_BUSCA = reverse("rotas-origem-busca")
URL_REVERSA = reverse("rotas-origem-reversa")


@patch("rotas.views.buscar_enderecos", return_value=[])
class OrigemBuscaTest(APITestCase):
    def setUp(self):
        cache.clear()

    def test_busca_publica_devolve_resultados(self, buscar):
        buscar.return_value = [
            {"rotulo": "R", "latitude": -23.5, "longitude": -46.6}
        ]

        resposta = self.client.get(URL_BUSCA, {"q": "rua augusta"})

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"resultados": buscar.return_value})
        buscar.assert_called_once_with("rua augusta", None, None)

    def test_busca_arredonda_vies_em_duas_casas(self, buscar):
        resposta = self.client.get(
            URL_BUSCA,
            {"q": "rua", "latitude": -23.5614961, "longitude": -46.6559677},
        )

        self.assertEqual(resposta.status_code, 200)
        buscar.assert_called_once_with("rua", -23.56, -46.66)

    def test_busca_com_coordenada_zero_e_valida(self, buscar):
        resposta = self.client.get(
            URL_BUSCA, {"q": "abc", "latitude": 0, "longitude": 0}
        )

        self.assertEqual(resposta.status_code, 200)
        buscar.assert_called_once_with("abc", 0.0, 0.0)

    def test_busca_normaliza_texto_para_cliente_e_cache(self, buscar):
        primeira = self.client.get(URL_BUSCA, {"q": "  Rua   São  João "})
        segunda = self.client.get(URL_BUSCA, {"q": "rua são joão"})

        self.assertEqual(primeira.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        buscar.assert_called_once_with("Rua São João", None, None)

    def test_busca_valida_parametros(self, buscar):
        casos = [
            ({}, "q"),
            ({"q": "ab"}, "q"),
            ({"q": "  ab  "}, "q"),
            ({"q": "a" * 201}, "q"),
            ({"q": "abc", "latitude": -23.5}, "non_field_errors"),
            ({"q": "abc", "longitude": -46.6}, "non_field_errors"),
            ({"q": "abc", "latitude": 91, "longitude": 0}, "latitude"),
            ({"q": "abc", "latitude": 0, "longitude": -181}, "longitude"),
            ({"q": "abc", "latitude": "abc", "longitude": 0}, "latitude"),
        ]
        for parametros, campo in casos:
            with self.subTest(parametros=parametros):
                resposta = self.client.get(URL_BUSCA, parametros)

                self.assertEqual(resposta.status_code, 400)
                self.assertIn(campo, resposta.json())
        buscar.assert_not_called()

    def test_busca_aceita_limites(self, buscar):
        for texto in ("abc", "a" * 200, "a  b"):
            with self.subTest(texto=texto):
                resposta = self.client.get(URL_BUSCA, {"q": texto})

                self.assertEqual(resposta.status_code, 200)

    def test_parametros_estranhos_dao_400_sem_chamar_cliente(self, buscar):
        casos = [
            {"q": "abc", "latitude": "nan", "longitude": 0},
            {"q": "abc", "latitude": 0, "longitude": "inf"},
            {"q": "ab\x00c"},
        ]
        for parametros in casos:
            with self.subTest(parametros=parametros):
                resposta = self.client.get(URL_BUSCA, parametros)

                self.assertEqual(resposta.status_code, 400)
        buscar.assert_not_called()

    def test_busca_erro_do_photon_da_502_sem_cachear(self, buscar):
        buscar.side_effect = [ErroPhoton("tempo esgotado"), []]

        with self.assertLogs("rotas.views", "WARNING") as logs:
            primeira = self.client.get(URL_BUSCA, {"q": "rua augusta"})
        segunda = self.client.get(URL_BUSCA, {"q": "rua augusta"})

        self.assertEqual(primeira.status_code, 502)
        self.assertEqual(primeira.json(), ERRO_UPSTREAM)
        self.assertNotIn("tempo esgotado", primeira.content.decode())
        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(buscar.call_count, 2)
        (linha,) = logs.output
        self.assertIn("Photon falhou: tempo esgotado", linha)
        self.assertNotIn("augusta", linha)

    def test_busca_cache_separa_vies_diferente(self, buscar):
        self.client.get(
            URL_BUSCA, {"q": "rua", "latitude": -23.55, "longitude": -46.63}
        )
        self.client.get(
            URL_BUSCA, {"q": "rua", "latitude": -22.90, "longitude": -43.17}
        )

        self.assertEqual(buscar.call_count, 2)

    def test_busca_cache_junta_vies_que_arredonda_igual(self, buscar):
        self.client.get(
            URL_BUSCA, {"q": "rua", "latitude": -23.55, "longitude": -46.63}
        )
        self.client.get(
            URL_BUSCA, {"q": "rua", "latitude": -23.551, "longitude": -46.631}
        )

        self.assertEqual(buscar.call_count, 1)

    def test_busca_cache_nao_confunde_texto_com_barra(self, buscar):
        self.client.get(
            URL_BUSCA, {"q": "x|1.0", "latitude": 2.0, "longitude": 3.0}
        )
        self.client.get(URL_BUSCA, {"q": "x|1.0|2.0|3.0"})

        self.assertEqual(buscar.call_count, 2)


@patch("rotas.views.buscar_endereco_reverso", return_value="R")
class OrigemReversaTest(APITestCase):
    def setUp(self):
        cache.clear()

    def test_reversa_publica_devolve_rotulo(self, reverso):
        reverso.return_value = "Rua Antônio de Queiroga, Moema, São Paulo"

        resposta = self.client.get(
            URL_REVERSA, {"latitude": -23.58736, "longitude": -46.65757}
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            resposta.json(),
            {"rotulo": "Rua Antônio de Queiroga, Moema, São Paulo"},
        )
        reverso.assert_called_once_with(-23.5874, -46.6576)

    def test_reversa_sem_resultado_devolve_null_e_cacheia(self, reverso):
        reverso.return_value = None
        parametros = {"latitude": -25.0, "longitude": -40.0}

        primeira = self.client.get(URL_REVERSA, parametros)
        segunda = self.client.get(URL_REVERSA, parametros)

        self.assertEqual(primeira.json(), {"rotulo": None})
        self.assertEqual(segunda.json(), {"rotulo": None})
        self.assertEqual(reverso.call_count, 1)

    def test_reversa_cache_por_coordenada_arredondada(self, reverso):
        self.client.get(
            URL_REVERSA, {"latitude": -23.58736, "longitude": -46.65757}
        )
        self.client.get(
            URL_REVERSA, {"latitude": -23.58744, "longitude": -46.65762}
        )

        reverso.assert_called_once_with(-23.5874, -46.6576)

    def test_reversa_valida_parametros(self, reverso):
        casos = [
            ({"longitude": -46.6}, "latitude"),
            ({"latitude": -23.5}, "longitude"),
            ({"latitude": -91, "longitude": 0}, "latitude"),
            ({"latitude": 0, "longitude": "x"}, "longitude"),
            ({"latitude": "nan", "longitude": 0}, "latitude"),
        ]
        for parametros, campo in casos:
            with self.subTest(parametros=parametros):
                resposta = self.client.get(URL_REVERSA, parametros)

                self.assertEqual(resposta.status_code, 400)
                self.assertIn(campo, resposta.json())
        reverso.assert_not_called()

    def test_reversa_erro_do_photon_da_502(self, reverso):
        reverso.side_effect = ErroPhoton("Photon respondeu HTTP 503")

        with self.assertLogs("rotas.views", "WARNING") as logs:
            resposta = self.client.get(
                URL_REVERSA, {"latitude": -23.5, "longitude": -46.6}
            )

        self.assertEqual(resposta.status_code, 502)
        self.assertEqual(resposta.json(), ERRO_UPSTREAM)
        (linha,) = logs.output
        self.assertIn("Photon respondeu HTTP 503", linha)
        self.assertNotIn("23.5", linha)
