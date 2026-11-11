import http.client
import json
import urllib.error
from io import BytesIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.test import SimpleTestCase

from rotas.photon import USER_AGENT, ErroPhoton, _get_json


def resposta_json(dados):
    return BytesIO(json.dumps(dados).encode())


def erro_http(codigo):
    return urllib.error.HTTPError("u", codigo, "x", {}, None)


@patch("rotas.photon.urllib.request.urlopen")
class TransporteTest(SimpleTestCase):
    def test_get_json_monta_requisicao(self, urlopen):
        urlopen.return_value = resposta_json({"features": []})

        with self.settings(PHOTON_URL="https://photon.exemplo"):
            dados = _get_json("/api/", {"q": "são joão", "limit": 10})

        self.assertEqual(dados, {"features": []})
        (requisicao,) = urlopen.call_args.args
        url = urlparse(requisicao.full_url)
        self.assertEqual(url.netloc, "photon.exemplo")
        self.assertEqual(url.path, "/api/")
        self.assertEqual(parse_qs(url.query)["q"], ["são joão"])
        self.assertEqual(parse_qs(url.query)["limit"], ["10"])
        self.assertEqual(requisicao.get_header("User-agent"), USER_AGENT)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 5)

    def test_photon_url_com_barra_no_fim(self, urlopen):
        urlopen.return_value = resposta_json({"features": []})

        with self.settings(PHOTON_URL="https://photon.exemplo/"):
            _get_json("/api/", {})

        (requisicao,) = urlopen.call_args.args
        self.assertEqual(urlparse(requisicao.full_url).path, "/api/")

    def test_nova_tentativa_em_falha_passageira(self, urlopen):
        falhas = [
            TimeoutError(),
            urllib.error.URLError(OSError("rede")),
            erro_http(503),
            http.client.RemoteDisconnected(),
        ]
        for falha in falhas:
            with self.subTest(falha=type(falha).__name__):
                urlopen.reset_mock()
                urlopen.side_effect = [
                    falha,
                    resposta_json({"features": []}),
                ]

                self.assertEqual(_get_json("/api/", {}), {"features": []})
                self.assertEqual(urlopen.call_count, 2)

    def test_duas_falhas_passageiras_levantam_erro(self, urlopen):
        urlopen.side_effect = [TimeoutError(), TimeoutError()]

        with self.assertRaises(ErroPhoton):
            _get_json("/api/", {})
        self.assertEqual(urlopen.call_count, 2)

    def test_http_4xx_nao_tenta_de_novo(self, urlopen):
        urlopen.side_effect = erro_http(400)

        with self.assertRaises(ErroPhoton):
            _get_json("/api/", {})
        self.assertEqual(urlopen.call_count, 1)

    def test_json_invalido_nao_tenta_de_novo(self, urlopen):
        urlopen.return_value = BytesIO(b"<html>")

        with self.assertRaises(ErroPhoton):
            _get_json("/api/", {})
        self.assertEqual(urlopen.call_count, 1)

    def test_json_sem_features_lista_e_resposta_invalida(self, urlopen):
        for dados in ([], {}, {"features": None}, {"features": {}}):
            with self.subTest(dados=dados):
                urlopen.reset_mock()
                urlopen.return_value = resposta_json(dados)

                with self.assertRaises(ErroPhoton):
                    _get_json("/api/", {})
                self.assertEqual(urlopen.call_count, 1)

    def test_mensagem_de_erro_nao_leva_a_url(self, urlopen):
        urlopen.side_effect = erro_http(404)

        with self.assertRaises(ErroPhoton) as contexto:
            _get_json("/api/", {"q": "rua secreta"})
        self.assertNotIn("rua secreta", str(contexto.exception))
        self.assertIn("404", str(contexto.exception))
