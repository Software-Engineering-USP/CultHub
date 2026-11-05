import http.client
import json
import urllib.error
from io import BytesIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.test import SimpleTestCase

from clima.servicos import (
    ErroOpenMeteo,
    _get_json,
    buscar_localidades,
    buscar_previsao,
)


def resposta_json(dados):
    return BytesIO(json.dumps(dados).encode())


class ClienteOpenMeteoTest(SimpleTestCase):
    @patch("clima.servicos.urllib.request.urlopen")
    def test_busca_localidades_monta_url_e_retorna_resultados(self, urlopen):
        resultados = [{"name": "São Paulo", "country_code": "BR"}]
        urlopen.return_value = resposta_json({"results": resultados})

        resposta = buscar_localidades("São Paulo", "br")

        self.assertEqual(resposta, resultados)
        (url,) = urlopen.call_args.args
        parametros = parse_qs(urlparse(url).query)
        self.assertEqual(urlparse(url).netloc, "geocoding-api.open-meteo.com")
        self.assertEqual(parametros["name"], ["São Paulo"])
        self.assertEqual(parametros["countryCode"], ["BR"])
        self.assertEqual(parametros["language"], ["pt"])
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 10)

    @patch("clima.servicos.urllib.request.urlopen")
    def test_busca_localidades_sem_resultados_retorna_lista_vazia(
        self, urlopen
    ):
        urlopen.return_value = resposta_json({})

        self.assertEqual(buscar_localidades("Xyz"), [])
        (url,) = urlopen.call_args.args
        self.assertNotIn("countryCode", parse_qs(urlparse(url).query))

    @patch("clima.servicos.urllib.request.urlopen")
    def test_busca_previsao_envia_coordenadas_e_variaveis(self, urlopen):
        dados = {"current": {"temperature_2m": 22.0}, "daily": {}}
        urlopen.return_value = resposta_json(dados)

        resposta = buscar_previsao(-23.55, -46.63, 5)

        self.assertEqual(resposta, dados)
        (url,) = urlopen.call_args.args
        parametros = parse_qs(urlparse(url).query)
        self.assertEqual(urlparse(url).netloc, "api.open-meteo.com")
        self.assertEqual(parametros["latitude"], ["-23.55"])
        self.assertEqual(parametros["longitude"], ["-46.63"])
        self.assertEqual(parametros["forecast_days"], ["5"])
        self.assertEqual(parametros["timezone"], ["auto"])
        self.assertIn("temperature_2m", parametros["current"][0])
        self.assertIn("temperature_2m_max", parametros["daily"][0])

    def test_falhas_de_rede_sao_convertidas_em_erro_openmeteo(self):
        falhas = (
            (
                urllib.error.HTTPError("url", 503, "indisponível", {}, None),
                "HTTP 503",
            ),
            (urllib.error.URLError("offline"), "falha de rede (str)"),
            (TimeoutError(), "tempo esgotado"),
            (OSError("offline"), "falha de transporte (OSError)"),
            (
                http.client.HTTPException(),
                "falha de transporte (HTTPException)",
            ),
        )

        for falha, mensagem in falhas:
            with (
                self.subTest(falha=type(falha).__name__),
                patch(
                    "clima.servicos.urllib.request.urlopen", side_effect=falha
                ),
                self.assertRaises(ErroOpenMeteo) as erro,
            ):
                _get_json("https://open-meteo.test", {})
                self.assertEqual(str(erro.exception), mensagem)

    def test_resposta_que_nao_e_json_e_reportada_como_erro(self):
        with (
            patch(
                "clima.servicos.urllib.request.urlopen",
                return_value=BytesIO(b"isto nao e json"),
            ),
            self.assertRaisesRegex(ErroOpenMeteo, "resposta inválida"),
        ):
            _get_json("https://open-meteo.test", {})

    def test_resposta_de_erro_ou_formato_invalido_e_rejeitada(self):
        for corpo in ({"error": True}, ["formato inesperado"]):
            with (
                self.subTest(corpo=corpo),
                patch(
                    "clima.servicos.urllib.request.urlopen",
                    return_value=resposta_json(corpo),
                ),
                self.assertRaisesRegex(ErroOpenMeteo, "resposta inválida"),
            ):
                _get_json("https://open-meteo.test", {})
