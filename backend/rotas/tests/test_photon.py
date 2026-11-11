import http.client
import json
import urllib.error
from io import BytesIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.test import SimpleTestCase

from rotas.photon import (
    BBOX_BRASIL,
    USER_AGENT,
    ErroPhoton,
    _get_json,
    buscar_endereco_reverso,
    buscar_enderecos,
    montar_rotulo,
)


def resposta_json(dados):
    return BytesIO(json.dumps(dados).encode())


def erro_http(codigo):
    return urllib.error.HTTPError("u", codigo, "x", {}, None)


def feature(propriedades, lon=-46.6, lat=-23.5, pais="BR"):
    if pais is not None:
        propriedades = {**propriedades, "countrycode": pais}
    return {
        "type": "Feature",
        "properties": propriedades,
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
    }


def colecao(*features):
    return resposta_json({"type": "FeatureCollection", "features": features})


def parametros_da_chamada(urlopen):
    (requisicao,) = urlopen.call_args.args
    url = urlparse(requisicao.full_url)
    return url.path, parse_qs(url.query)


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


class RotuloTest(SimpleTestCase):
    def test_rotulo_exemplos_do_spec(self):
        casos = [
            (
                {
                    "housenumber": "1500",
                    "street": "Rua Augusta",
                    "district": "Consolação",
                    "city": "São Paulo",
                },
                "Rua Augusta, 1500, Consolação, São Paulo",
            ),
            (
                {
                    "name": "Rua Antônio de Queiroga",
                    "district": "Moema",
                    "city": "São Paulo",
                },
                "Rua Antônio de Queiroga, Moema, São Paulo",
            ),
            (
                {
                    "name": "MASP Suplicy",
                    "street": "Avenida Nove de Julho",
                    "district": "Jardim Paulista",
                    "city": "São Paulo",
                },
                (
                    "MASP Suplicy – Avenida Nove de Julho, "
                    "Jardim Paulista, São Paulo"
                ),
            ),
        ]
        for propriedades, esperado in casos:
            with self.subTest(esperado=esperado):
                self.assertEqual(montar_rotulo(propriedades), esperado)

    def test_rotulo_casos_de_borda(self):
        casos = [
            ({"street": "Rua X", "city": "C"}, "Rua X, C"),
            ({"name": "Rua X", "street": "Rua X", "city": "C"}, "Rua X, C"),
            ({"locality": "L", "city": "C"}, "L, C"),
            ({"district": "D", "locality": "L", "city": "C"}, "D, C"),
            ({"name": "N", "state": "SP"}, "N, SP"),
            ({"name": "N", "city": "C", "state": "SP"}, "N, C"),
            ({"name": "São Paulo", "city": "São Paulo"}, "São Paulo"),
            ({"district": "Moema", "city": "São Paulo"}, "Moema, São Paulo"),
            ({}, None),
            ({"postcode": "01310-200"}, None),
        ]
        for propriedades, esperado in casos:
            with self.subTest(propriedades=propriedades):
                self.assertEqual(montar_rotulo(propriedades), esperado)


@patch("rotas.photon.urllib.request.urlopen")
class BuscaTest(SimpleTestCase):
    def test_busca_monta_parametros_com_vies(self, urlopen):
        urlopen.return_value = colecao()

        buscar_enderecos("rua augusta", -23.55, -46.63)

        caminho, parametros = parametros_da_chamada(urlopen)
        self.assertEqual(caminho, "/api/")
        self.assertEqual(parametros["q"], ["rua augusta"])
        self.assertEqual(parametros["limit"], ["10"])
        self.assertEqual(parametros["bbox"], [BBOX_BRASIL])
        self.assertEqual(parametros["lat"], ["-23.55"])
        self.assertEqual(parametros["lon"], ["-46.63"])
        self.assertNotIn("lang", parametros)

    def test_busca_sem_vies_nao_envia_lat_lon(self, urlopen):
        urlopen.return_value = colecao()

        buscar_enderecos("rua augusta")

        _, parametros = parametros_da_chamada(urlopen)
        self.assertNotIn("lat", parametros)
        self.assertNotIn("lon", parametros)

    def test_busca_envia_vies_zero(self, urlopen):
        urlopen.return_value = colecao()

        buscar_enderecos("abc", 0.0, 0.0)

        _, parametros = parametros_da_chamada(urlopen)
        self.assertEqual(parametros["lat"], ["0.0"])
        self.assertEqual(parametros["lon"], ["0.0"])

    def test_busca_converte_ordem_lon_lat(self, urlopen):
        urlopen.return_value = colecao(
            feature(
                {
                    "housenumber": "1500",
                    "street": "Rua Augusta",
                    "district": "Consolação",
                    "city": "São Paulo",
                },
                lon=-46.6586475,
                lat=-23.5565457,
            )
        )

        resultados = buscar_enderecos("rua augusta 1500")

        self.assertEqual(
            resultados,
            [
                {
                    "rotulo": "Rua Augusta, 1500, Consolação, São Paulo",
                    "latitude": -23.5565457,
                    "longitude": -46.6586475,
                }
            ],
        )

    def test_busca_deduplica_filtra_e_corta_em_cinco(self, urlopen):
        urlopen.return_value = colecao(
            feature({"name": "A"}, lon=1, lat=1, pais="AR"),
            feature({"name": "A"}, lon=2, lat=2),
            feature({"name": "A"}, lon=3, lat=3),
            *(feature({"name": nome}) for nome in "BCDEF"),
        )

        resultados = buscar_enderecos("abc")

        self.assertEqual(
            [item["rotulo"] for item in resultados],
            ["A", "B", "C", "D", "E"],
        )
        self.assertEqual(
            (resultados[0]["latitude"], resultados[0]["longitude"]), (2, 2)
        )

    def test_busca_descarta_features_malformadas(self, urlopen):
        sem_geometria = feature({"name": "G"})
        sem_geometria["geometry"] = None
        sem_coordenadas = feature({"name": "C"})
        del sem_coordenadas["geometry"]["coordinates"]
        texto = feature({"name": "T"})
        texto["geometry"]["coordinates"] = ["x", "y"]
        curta = feature({"name": "U"})
        curta["geometry"]["coordinates"] = [1]
        booleana = feature({"name": "B"})
        booleana["geometry"]["coordinates"] = [True, False]
        sem_propriedades = feature({})
        sem_propriedades["properties"] = None
        urlopen.return_value = colecao(
            None,
            "texto",
            sem_propriedades,
            feature({"postcode": "01310-200"}),
            sem_geometria,
            sem_coordenadas,
            texto,
            curta,
            booleana,
            feature({"name": "Sem país"}, pais=None),
            feature({"name": "Válida"}),
        )

        resultados = buscar_enderecos("abc")

        self.assertEqual([item["rotulo"] for item in resultados], ["Válida"])

    def test_busca_sem_resultado_devolve_lista_vazia(self, urlopen):
        urlopen.return_value = colecao()

        self.assertEqual(buscar_enderecos("abc"), [])

    def test_busca_propaga_erro_do_photon(self, urlopen):
        urlopen.side_effect = erro_http(400)

        with self.assertRaises(ErroPhoton):
            buscar_enderecos("abc")


@patch("rotas.photon.urllib.request.urlopen")
class ReversaTest(SimpleTestCase):
    def test_reversa_monta_parametros(self, urlopen):
        urlopen.return_value = colecao()

        buscar_endereco_reverso(-23.5874, -46.6576)

        caminho, parametros = parametros_da_chamada(urlopen)
        self.assertEqual(caminho, "/reverse")
        self.assertEqual(parametros["lat"], ["-23.5874"])
        self.assertEqual(parametros["lon"], ["-46.6576"])
        self.assertEqual(parametros["limit"], ["1"])

    def test_reversa_devolve_rotulo_sem_filtrar_pais(self, urlopen):
        urlopen.return_value = colecao(
            feature(
                {"name": "Avenida Corrientes", "city": "Buenos Aires"},
                pais="AR",
            )
        )

        self.assertEqual(
            buscar_endereco_reverso(-34.6, -58.4),
            "Avenida Corrientes, Buenos Aires",
        )

    def test_reversa_vazia_ou_malformada_devolve_none(self, urlopen):
        sem_geometria = feature({"name": "G"})
        sem_geometria["geometry"] = None
        casos = {
            "vazia": colecao(),
            "item nulo": colecao(None),
            "sem geometria": colecao(sem_geometria),
            "sem dados": colecao(feature({})),
        }
        for nome, resposta in casos.items():
            with self.subTest(nome):
                urlopen.return_value = resposta

                self.assertIsNone(buscar_endereco_reverso(-25.0, -40.0))
