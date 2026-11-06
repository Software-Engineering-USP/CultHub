from unittest.mock import patch

from django.core.cache import cache
from rest_framework.test import APITestCase

from clima.servicos import ErroOpenMeteo


class LocalidadesApiTest(APITestCase):
    def setUp(self):
        cache.clear()

    @patch("clima.views.buscar_localidades")
    def test_busca_localidade_por_nome_e_pais(self, buscar):
        buscar.return_value = [
            {
                "name": "São Paulo",
                "latitude": -23.55,
                "longitude": -46.63,
                "country_code": "BR",
            }
        ]

        resposta = self.client.get(
            "/api/clima/localidades/?nome=São Paulo&pais=br"
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["resultados"][0]["name"], "São Paulo")
        buscar.assert_called_once_with("São Paulo", "br")

    def test_nome_obrigatorio_e_validado(self):
        resposta = self.client.get("/api/clima/localidades/")

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("nome", resposta.json())

    def test_codigo_de_pais_deve_ter_duas_letras(self):
        resposta = self.client.get(
            "/api/clima/localidades/?nome=São Paulo&pais=Brasil"
        )

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("pais", resposta.json())

    @patch(
        "clima.views.buscar_localidades", side_effect=ErroOpenMeteo("offline")
    )
    def test_falha_do_open_meteo_responde_502(self, buscar):
        resposta = self.client.get("/api/clima/localidades/?nome=São Paulo")

        self.assertEqual(resposta.status_code, 502)
        self.assertEqual(
            resposta.json(),
            {"detail": "Não foi possível consultar o serviço de clima."},
        )


class PrevisaoApiTest(APITestCase):
    def setUp(self):
        cache.clear()

    @patch("clima.views.buscar_previsao")
    def test_busca_previsao_com_coordenadas_e_dias(self, buscar):
        dados = {
            "latitude": -23.55,
            "longitude": -46.63,
            "timezone": "America/Sao_Paulo",
            "current": {"temperature_2m": 24.1},
            "daily": {"temperature_2m_max": [27.0]},
        }
        buscar.return_value = dados

        resposta = self.client.get(
            "/api/clima/previsao/?latitude=-23.55&longitude=-46.63&dias=5"
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), dados)
        buscar.assert_called_once_with(-23.55, -46.63, 5)

    @patch("clima.views.buscar_previsao")
    def test_dias_padrao_e_um(self, buscar):
        buscar.return_value = {"daily": {"time": []}}

        resposta = self.client.get(
            "/api/clima/previsao/?latitude=-23.55&longitude=-46.63"
        )

        self.assertEqual(resposta.status_code, 200)
        buscar.assert_called_once_with(-23.55, -46.63, 1)

    def test_coordenadas_obrigatorias(self):
        resposta = self.client.get("/api/clima/previsao/")

        self.assertEqual(resposta.status_code, 400)
        self.assertIn("latitude", resposta.json())
        self.assertIn("longitude", resposta.json())

    def test_rejeita_coordenadas_e_periodo_fora_dos_limites(self):
        casos = (
            "?latitude=91&longitude=0",
            "?latitude=0&longitude=-181",
            "?latitude=0&longitude=0&dias=17",
        )

        for consulta in casos:
            with self.subTest(consulta=consulta):
                resposta = self.client.get(f"/api/clima/previsao/{consulta}")
                self.assertEqual(resposta.status_code, 400)

    @patch("clima.views.buscar_previsao", side_effect=ErroOpenMeteo("offline"))
    def test_falha_do_open_meteo_responde_502(self, buscar):
        resposta = self.client.get(
            "/api/clima/previsao/?latitude=-23.55&longitude=-46.63"
        )

        self.assertEqual(resposta.status_code, 502)
        self.assertEqual(
            resposta.json(),
            {"detail": "Não foi possível consultar o serviço de clima."},
        )
