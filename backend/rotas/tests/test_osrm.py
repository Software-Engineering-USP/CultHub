import http.client
import json
import urllib.error
from io import BytesIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from django.test import SimpleTestCase, override_settings

from rotas.osrm import ErroOSRM, _consultar, calcular_rotas
from rotas.transporte import USER_AGENT, Espacador

ORIGEM = (-23.5874, -46.6576)
DESTINO = (-23.5615, -46.6559)
# Mensagem real do NoSegment (routing.openstreetmap.de, 12/11/2026), sem o
# índice do ponto.
SEM_SEGMENTO = "Could not find a matching segment for coordinate"


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


class SemEsperaTestCase(SimpleTestCase):
    """Testes de transporte sem o intervalo de 1 s entre requisições."""

    def setUp(self):
        super().setUp()
        espera = patch("rotas.osrm._vez.aguardar", return_value=True)
        self.aguardar = espera.start()
        self.addCleanup(espera.stop)


@patch("rotas.osrm.urllib.request.urlopen")
class TransporteTest(SemEsperaTestCase):
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

    def test_espera_a_vez_antes_de_cada_tentativa(self, urlopen):
        urlopen.side_effect = [TimeoutError(), resposta_json({"code": "Ok"})]

        _consultar("carro", ORIGEM, DESTINO)

        self.assertEqual(self.aguardar.call_count, 2)

    def test_fila_cheia_e_erro_sem_chamar(self, urlopen):
        self.aguardar.return_value = False

        with self.assertRaises(ErroOSRM):
            _consultar("carro", ORIGEM, DESTINO)
        urlopen.assert_not_called()

    @patch("rotas.transporte.time")
    def test_sem_nova_tentativa_quando_o_prazo_acaba(self, relogio, urlopen):
        relogio.monotonic.side_effect = [0, 0, 10.5]
        urlopen.side_effect = TimeoutError()

        with self.assertRaises(ErroOSRM) as contexto:
            _consultar("carro", ORIGEM, DESTINO)
        self.assertEqual(urlopen.call_count, 1)
        self.assertEqual(str(contexto.exception), "tempo esgotado")

    @patch("rotas.transporte.time")
    def test_nova_tentativa_usa_o_que_sobra_do_prazo(self, relogio, urlopen):
        relogio.monotonic.side_effect = [0, 0, 3]
        urlopen.side_effect = [erro_http(503), resposta_json({"code": "Ok"})]

        _consultar("carro", ORIGEM, DESTINO)

        tempos = [c.kwargs["timeout"] for c in urlopen.call_args_list]
        self.assertEqual(tempos, [10, 9])


GEOMETRIA = {
    "type": "LineString",
    "coordinates": [[-46.6567, -23.5878], [-46.6559, -23.5615]],
}


def rota(distancia=6614, duracao=772.5, geometria=GEOMETRIA):
    return {"distance": distancia, "duration": duracao, "geometry": geometria}


def resposta(rotas, encaixe_origem=10.0, encaixe_destino=5.0):
    return {
        "code": "Ok",
        "routes": rotas,
        "waypoints": [
            {"distance": encaixe_origem},
            {"distance": encaixe_destino},
        ],
    }


@patch("rotas.osrm._consultar")
class CalcularRotasTest(SimpleTestCase):
    def test_converte_rota(self, consultar):
        consultar.return_value = resposta([rota()])

        rotas = calcular_rotas("carro", ORIGEM, DESTINO)

        self.assertEqual(
            rotas,
            [
                {
                    "distancia_metros": 6614,
                    "duracao_segundos": 773,
                    "geometria": GEOMETRIA,
                }
            ],
        )
        consultar.assert_called_once_with("carro", ORIGEM, DESTINO)

    def test_arredonda_meio_para_cima(self, consultar):
        consultar.return_value = resposta(
            [rota(3973.9, 3179.5), rota(0.4, 0.5)]
        )

        rotas = calcular_rotas("a_pe", ORIGEM, DESTINO)

        self.assertEqual(
            [(r["distancia_metros"], r["duracao_segundos"]) for r in rotas],
            [(3974, 3180), (0, 1)],
        )

    def test_rota_de_distancia_zero_e_valida(self, consultar):
        parado = {"type": "LineString", "coordinates": [[-46.6, -23.5]] * 2}
        consultar.return_value = resposta([rota(0, 0, parado)])

        rotas = calcular_rotas("carro", DESTINO, DESTINO)

        self.assertEqual(
            rotas,
            [
                {
                    "distancia_metros": 0,
                    "duracao_segundos": 0,
                    "geometria": parado,
                }
            ],
        )

    def test_corta_em_tres_depois_do_descarte(self, consultar):
        ponto = {"type": "Point", "coordinates": [-46.6, -23.5]}
        consultar.return_value = resposta(
            [rota(1, geometria=ponto), rota(2), rota(3), rota(4), rota(5)]
        )

        rotas = calcular_rotas("carro", ORIGEM, DESTINO)

        self.assertEqual([r["distancia_metros"] for r in rotas], [2, 3, 4])

    def test_descarta_rotas_malformadas(self, consultar):
        sem_geometria = rota()
        del sem_geometria["geometry"]
        um_ponto = {"type": "LineString", "coordinates": [[-46.6, -23.5]]}
        malformadas = [
            None,
            "rota",
            sem_geometria,
            rota(geometria=um_ponto),
            rota(geometria={"type": "LineString", "coordinates": None}),
            rota(distancia="x"),
            rota(distancia=True),
            rota(distancia=float("nan")),
            rota(distancia=-1),
            rota(duracao=float("inf")),
            rota(duracao=None),
        ]
        consultar.return_value = resposta([*malformadas, rota(42)])

        rotas = calcular_rotas("carro", ORIGEM, DESTINO)

        self.assertEqual([r["distancia_metros"] for r in rotas], [42])

    def test_descarta_geometria_com_posicao_invalida(self, consultar):
        boa = [-46.6, -23.5]
        posicoes_ruins = [
            None,
            "x",
            [None, "x"],
            [-46.6],
            [-46.6, -23.5, 760],
            [float("inf"), -23.5],
            [-46.6, float("nan")],
            [10**400, -23.5],
            [True, False],
            [-181, -23.5],
            [-46.6, 91],
        ]
        rotas = [
            rota(
                distancia=i,
                geometria={"type": "LineString", "coordinates": [boa, ruim]},
            )
            for i, ruim in enumerate(posicoes_ruins)
        ]
        consultar.return_value = resposta([*rotas, rota(42)])

        convertidas = calcular_rotas("carro", ORIGEM, DESTINO)

        self.assertEqual([r["distancia_metros"] for r in convertidas], [42])

    def test_ok_sem_rota_valida_e_erro(self, consultar):
        for rotas in ([], [None, rota(distancia="x")]):
            with self.subTest(rotas=rotas):
                consultar.return_value = resposta(rotas)

                with self.assertRaises(ErroOSRM):
                    calcular_rotas("carro", ORIGEM, DESTINO)

    def test_sem_rota_devolve_lista_vazia(self, consultar):
        for codigo in ("NoRoute", "NoSegment"):
            with self.subTest(codigo=codigo):
                consultar.return_value = {"code": codigo, "message": "m"}

                self.assertEqual(calcular_rotas("carro", ORIGEM, DESTINO), [])

    def test_no_segment_do_destino_e_none(self, consultar):
        consultar.return_value = {
            "code": "NoSegment",
            "message": f"{SEM_SEGMENTO} 1",
        }

        self.assertIsNone(calcular_rotas("carro", ORIGEM, DESTINO))

    def test_no_segment_da_origem_ou_sem_indice_e_lista_vazia(self, consultar):
        casos = [
            {
                "code": "NoSegment",
                "message": f"{SEM_SEGMENTO} 0",
            },
            {
                "code": "NoRoute",
                "message": f"{SEM_SEGMENTO} 1",
            },
            {"code": "NoSegment", "message": ["for coordinate 1"]},
            {"code": "NoSegment"},
        ]
        for dados in casos:
            with self.subTest(dados=dados):
                consultar.return_value = dados

                self.assertEqual(calcular_rotas("carro", ORIGEM, DESTINO), [])

    def test_codigo_inesperado_e_erro(self, consultar):
        for dados in ({"code": "InvalidUrl"}, {}, {"code": None}):
            with self.subTest(dados=dados):
                consultar.return_value = dados

                with self.assertRaises(ErroOSRM):
                    calcular_rotas("carro", ORIGEM, DESTINO)

    def test_origem_longe_da_via_e_sem_rota(self, consultar):
        consultar.return_value = resposta([rota()], encaixe_origem=1000.1)
        self.assertEqual(calcular_rotas("carro", ORIGEM, DESTINO), [])

        consultar.return_value = resposta([rota()], encaixe_origem=1000)
        self.assertEqual(len(calcular_rotas("carro", ORIGEM, DESTINO)), 1)

    def test_destino_longe_da_via_e_none(self, consultar):
        consultar.return_value = resposta([rota()], encaixe_destino=1000.1)
        self.assertIsNone(calcular_rotas("carro", ORIGEM, DESTINO))

        consultar.return_value = resposta(
            [rota()], encaixe_origem=302218.3, encaixe_destino=1500
        )
        self.assertIsNone(calcular_rotas("carro", ORIGEM, DESTINO))

        consultar.return_value = resposta([rota()], encaixe_destino=1000)
        self.assertEqual(len(calcular_rotas("carro", ORIGEM, DESTINO)), 1)

    def test_waypoints_malformados_sao_resposta_invalida(self, consultar):
        sem_waypoints = resposta([rota()])
        del sem_waypoints["waypoints"]
        um_waypoint = resposta([rota()])
        um_waypoint["waypoints"] = um_waypoint["waypoints"][:1]
        casos = [
            sem_waypoints,
            um_waypoint,
            resposta([rota()], encaixe_origem=None),
            resposta([rota()], encaixe_destino="10"),
            resposta([rota()], encaixe_destino=True),
            {**resposta([rota()]), "waypoints": [None, None]},
        ]
        for dados in casos:
            with self.subTest(dados=dados):
                consultar.return_value = dados

                with self.assertRaises(ErroOSRM):
                    calcular_rotas("carro", ORIGEM, DESTINO)

    def test_routes_que_nao_e_lista_e_erro(self, consultar):
        consultar.return_value = {**resposta([]), "routes": None}

        with self.assertRaises(ErroOSRM):
            calcular_rotas("carro", ORIGEM, DESTINO)


@patch("rotas.osrm._consultar")
class RespostaEstranhaTest(SimpleTestCase):
    def test_codigo_que_nao_e_texto_e_erro(self, consultar):
        for codigo in (["Ok"], {}, ["NoRoute"]):
            with self.subTest(codigo=codigo):
                consultar.return_value = {**resposta([rota()]), "code": codigo}

                with self.assertRaises(ErroOSRM):
                    calcular_rotas("carro", ORIGEM, DESTINO)

    def test_numero_gigante_e_resposta_invalida(self, consultar):
        gigante = 10**400
        consultar.return_value = resposta([rota()], encaixe_destino=gigante)
        with self.assertRaises(ErroOSRM):
            calcular_rotas("carro", ORIGEM, DESTINO)

        consultar.return_value = resposta([rota(gigante), rota(42)])
        rotas = calcular_rotas("carro", ORIGEM, DESTINO)
        self.assertEqual([r["distancia_metros"] for r in rotas], [42])


@patch("rotas.osrm.urllib.request.urlopen")
class Http400EstranhoTest(SemEsperaTestCase):
    def test_http_400_com_codigo_que_nao_e_texto_e_erro(self, urlopen):
        for codigo in (["NoRoute"], {}):
            with self.subTest(codigo=codigo):
                urlopen.reset_mock()
                urlopen.side_effect = erro_http(400, {"code": codigo})

                with self.assertRaises(ErroOSRM):
                    _consultar("carro", ORIGEM, DESTINO)
                self.assertEqual(urlopen.call_count, 1)


class EspacadorTest(SimpleTestCase):
    def setUp(self):
        self.agora = 100.0
        self.esperas = []
        self.espacador = Espacador(
            1, 2, relogio=lambda: self.agora, dormir=self.esperas.append
        )

    def test_primeira_vez_nao_espera(self):
        self.assertTrue(self.espacador.aguardar())
        self.assertEqual(self.esperas, [])

    def test_requisicoes_seguidas_esperam_a_vez(self):
        for _ in range(3):
            self.assertTrue(self.espacador.aguardar())

        self.assertEqual(self.esperas, [1, 2])

    def test_fila_longa_demais_recusa_sem_reservar(self):
        for _ in range(3):
            self.espacador.aguardar()

        self.assertFalse(self.espacador.aguardar())
        self.agora += 1
        self.assertTrue(self.espacador.aguardar())
        self.assertEqual(self.esperas, [1, 2, 2])

    def test_depois_do_intervalo_nao_espera(self):
        self.espacador.aguardar()
        self.agora += 1.5

        self.assertTrue(self.espacador.aguardar())
        self.assertEqual(self.esperas, [])
