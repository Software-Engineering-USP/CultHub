import http.client
import json
import urllib.error
from io import BytesIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from django.test import SimpleTestCase, override_settings

from rotas.osrm import ErroOSRM, _consultar
from rotas.photon import USER_AGENT

ORIGEM = (-23.5874, -46.6576)
DESTINO = (-23.5615, -46.6559)


def resposta_json(dados):
    return BytesIO(json.dumps(dados).encode())


def erro_http(codigo, corpo=None):
    if corpo is not None and not isinstance(corpo, bytes):
        corpo = json.dumps(corpo).encode()
    fp = BytesIO(corpo) if corpo is not None else None
    return urllib.error.HTTPError("u", codigo, "x", {}, fp)


def requisicao_da_chamada(urlopen):
    (requisicao,) = urlopen.call_args.args
    return requisicao, urlsplit(requisicao.full_url)


@patch("rotas.osrm.urllib.request.urlopen")
class TransporteTest(SimpleTestCase):
    @override_settings(OSRM_CARRO_URL="https://osrm.exemplo/car/")
    def test_monta_url_do_carro(self, urlopen):
        urlopen.return_value = resposta_json({"code": "Ok"})

        dados = _consultar("carro", ORIGEM, DESTINO)

        self.assertEqual(dados, {"code": "Ok"})
        requisicao, url = requisicao_da_chamada(urlopen)
        self.assertEqual(url.netloc, "osrm.exemplo")
        self.assertEqual(
            url.path,
            "/car/route/v1/driving/"
            "-46.657600,-23.587400;-46.655900,-23.561500",
        )
        self.assertEqual(
            parse_qs(url.query),
            {
                "overview": ["full"],
                "geometries": ["geojson"],
                "steps": ["false"],
                "alternatives": ["true"],
            },
        )
        self.assertEqual(requisicao.get_header("User-agent"), USER_AGENT)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 10)

    @override_settings(OSRM_A_PE_URL="https://osrm.exemplo/foot")
    def test_monta_url_a_pe(self, urlopen):
        urlopen.return_value = resposta_json({"code": "Ok"})

        _consultar("a_pe", ORIGEM, DESTINO)

        _, url = requisicao_da_chamada(urlopen)
        self.assertEqual(
            url.path,
            "/foot/route/v1/foot/-46.657600,-23.587400;-46.655900,-23.561500",
        )

    def test_coordenada_perto_do_zero_nao_vira_notacao_cientifica(
        self, urlopen
    ):
        urlopen.return_value = resposta_json({"code": "Ok"})

        _consultar("carro", ORIGEM, (0.000001, -0.000009))

        _, url = requisicao_da_chamada(urlopen)
        self.assertTrue(url.path.endswith(";-0.000009,0.000001"), url.path)

    def test_url_invalida_e_erro_sem_chamar(self, urlopen):
        with (
            override_settings(OSRM_CARRO_URL="routing.exemplo"),
            self.assertRaises(ErroOSRM),
        ):
            _consultar("carro", ORIGEM, DESTINO)
        urlopen.assert_not_called()

    def test_falha_passageira_tenta_de_novo(self, urlopen):
        urlopen.side_effect = [TimeoutError(), resposta_json({"code": "Ok"})]

        self.assertEqual(_consultar("carro", ORIGEM, DESTINO), {"code": "Ok"})
        self.assertEqual(urlopen.call_count, 2)

    def test_duas_falhas_viram_erro(self, urlopen):
        falhas = [
            lambda: erro_http(503),
            lambda: urllib.error.URLError(OSError("rede")),
            TimeoutError,
            http.client.RemoteDisconnected,
        ]
        for falha in falhas:
            with self.subTest(falha=falha):
                urlopen.reset_mock()
                urlopen.side_effect = [falha(), falha()]

                with self.assertRaises(ErroOSRM):
                    _consultar("carro", ORIGEM, DESTINO)
                self.assertEqual(urlopen.call_count, 2)

    def test_http_400_sem_rota_devolve_o_corpo(self, urlopen):
        for codigo in ("NoRoute", "NoSegment"):
            with self.subTest(codigo=codigo):
                urlopen.reset_mock()
                corpo = {"code": codigo, "message": "Impossible route"}
                urlopen.side_effect = erro_http(400, corpo)

                self.assertEqual(_consultar("carro", ORIGEM, DESTINO), corpo)
                self.assertEqual(urlopen.call_count, 1)

    def test_http_400_sem_codigo_conhecido_e_erro(self, urlopen):
        corpos = [b"oi", b"", b"{}", b"[]", {"code": "InvalidQuery"}, None]
        for corpo in corpos:
            with self.subTest(corpo=corpo):
                urlopen.reset_mock()
                urlopen.side_effect = erro_http(400, corpo)

                with self.assertRaises(ErroOSRM):
                    _consultar("carro", ORIGEM, DESTINO)
                self.assertEqual(urlopen.call_count, 1)

    def test_outros_4xx_nao_repetem(self, urlopen):
        for codigo in (404, 429):
            with self.subTest(codigo=codigo):
                urlopen.reset_mock()
                urlopen.side_effect = erro_http(codigo, {"code": "NoRoute"})

                with self.assertRaises(ErroOSRM):
                    _consultar("carro", ORIGEM, DESTINO)
                self.assertEqual(urlopen.call_count, 1)

    def test_resposta_invalida(self, urlopen):
        for corpo in (BytesIO(b"<html>"), resposta_json([])):
            with self.subTest(corpo=corpo):
                urlopen.reset_mock()
                urlopen.return_value = corpo

                with self.assertRaises(ErroOSRM):
                    _consultar("carro", ORIGEM, DESTINO)
                self.assertEqual(urlopen.call_count, 1)

    def test_mensagem_de_erro_nao_leva_as_coordenadas(self, urlopen):
        urlopen.side_effect = erro_http(404)

        with self.assertRaises(ErroOSRM) as contexto:
            _consultar("carro", ORIGEM, DESTINO)
        self.assertNotIn("23.58", str(contexto.exception))
