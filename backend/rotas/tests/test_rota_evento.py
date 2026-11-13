import threading
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache, caches
from django.test import SimpleTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from catalogo.models import Evento, Local
from rotas.osrm import MODOS, ErroOSRM
from rotas.views import (
    DISTANCIA_MAXIMA_KM,
    ERRO_ROTA,
    LOCAL_FORA_DO_MAPA,
    LOCAL_SEM_COORDENADAS,
    MODOS_DE_ROTA,
    _rotas_do_cache,
)

ROTA = {
    "distancia_metros": 6614,
    "duracao_segundos": 773,
    "geometria": {
        "type": "LineString",
        "coordinates": [[-46.6, -23.5], [-46.7, -23.6]],
    },
}
PARAMS = {"latitude": -23.5874, "longitude": -46.6576, "modo": "carro"}
DESTINO = (-23.5615, -46.6559)


def url(evento_id):
    return reverse("rotas-evento", args=[evento_id])


@patch("rotas.views.calcular_rotas", return_value=[ROTA])
class RotaEventoTest(APITestCase):
    def setUp(self):
        cache.clear()
        caches["rotas"].clear()
        self.local = Local.objects.create(
            nome="MASP",
            latitude=Decimal("-23.561500"),
            longitude=Decimal("-46.655900"),
        )
        self.evento = Evento.objects.create(
            titulo="E", local=self.local, data_inicio=date(2026, 11, 20)
        )

    def get(self, evento=None, **parametros):
        evento_id = (evento or self.evento).pk
        return self.client.get(url(evento_id), {**PARAMS, **parametros})

    def test_modos_aceitos_sao_os_do_cliente(self, calcular):
        self.assertEqual(MODOS_DE_ROTA, tuple(MODOS))
        self.assertEqual(set(DISTANCIA_MAXIMA_KM), set(MODOS))

    def test_partida_longe_demais_da_400_sem_chamar_cliente(self, calcular):
        # O MASP fica em -23,5615; 1 grau de latitude são ~111 km.
        casos = [
            ("carro", -23.5615 + 1.3, 200),
            ("carro", -23.5615 + 1.4, 400),
            ("a_pe", -23.5615 + 0.26, 200),
            ("a_pe", -23.5615 + 0.28, 400),
        ]
        for modo, latitude, status in casos:
            with self.subTest(modo=modo, latitude=latitude):
                calcular.reset_mock()

                resposta = self.get(
                    modo=modo, latitude=latitude, longitude=-46.6559
                )

                self.assertEqual(resposta.status_code, status)
                self.assertEqual(calcular.called, status == 200)
                if status == 400:
                    self.assertIn(
                        f"{DISTANCIA_MAXIMA_KM[modo]} km",
                        resposta.json()["detail"],
                    )

    @patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"rota": "2/min"})
    def test_limite_de_pedidos_por_ip(self, calcular):
        respostas = [self.get().status_code for _ in range(3)]
        falsificado = self.client.get(
            url(self.evento.pk), PARAMS, HTTP_X_FORWARDED_FOR="10.9.9.9"
        )
        outro_ip = self.client.get(
            url(self.evento.pk), PARAMS, REMOTE_ADDR="10.0.0.2"
        )

        self.assertEqual(respostas, [200, 200, 429])
        self.assertEqual(falsificado.status_code, 429)
        self.assertEqual(outro_ip.status_code, 200)

    def test_rota_publica_nos_dois_modos(self, calcular):
        for modo in ("carro", "a_pe"):
            with self.subTest(modo=modo):
                caches["rotas"].clear()

                resposta = self.get(modo=modo)

                self.assertEqual(resposta.status_code, 200)
                self.assertEqual(
                    resposta.json(),
                    {
                        "modo": modo,
                        "destino": {
                            "latitude": -23.5615,
                            "longitude": -46.6559,
                        },
                        "rotas": [ROTA],
                    },
                )

    def test_origem_vai_arredondada_em_quatro_casas(self, calcular):
        self.get(latitude=-23.58745678, longitude=-46.65761234)

        calcular.assert_called_once_with(
            "carro", (-23.5875, -46.6576), DESTINO
        )

    def test_destino_do_banco_vai_como_float(self, calcular):
        self.get()
        self.get()

        calcular.assert_called_once()
        _, _, destino = calcular.call_args.args
        self.assertIs(type(destino[0]), float)
        self.assertIs(type(destino[1]), float)

    def test_origem_zero_e_valida(self, calcular):
        self.local.latitude = Decimal("0.050000")
        self.local.longitude = Decimal("0.050000")
        self.local.save()

        resposta = self.get(latitude=0, longitude=0)

        self.assertEqual(resposta.status_code, 200)
        calcular.assert_called_once_with("carro", (0.0, 0.0), (0.05, 0.05))

    def test_sem_rota_devolve_lista_vazia(self, calcular):
        calcular.return_value = []

        resposta = self.get()

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["rotas"], [])

    def test_evento_removido_tambem_responde(self, calcular):
        self.evento.removido_em = timezone.now()
        self.evento.save()

        self.assertEqual(self.get().status_code, 200)

    def test_parametros_invalidos_dao_400_sem_chamar_cliente(self, calcular):
        casos = [
            {"latitude": ""},
            {"latitude": 91},
            {"longitude": "x"},
            {"latitude": "nan"},
            {"modo": ""},
            {"modo": "onibus"},
        ]
        for parametros in casos:
            with self.subTest(parametros=parametros):
                resposta = self.get(**parametros)

                self.assertEqual(resposta.status_code, 400)
        sem_latitude = {k: v for k, v in PARAMS.items() if k != "latitude"}
        sem_modo = {k: v for k, v in PARAMS.items() if k != "modo"}
        for parametros in (sem_latitude, sem_modo):
            with self.subTest(parametros=parametros):
                resposta = self.client.get(url(self.evento.pk), parametros)

                self.assertEqual(resposta.status_code, 400)
        calcular.assert_not_called()

    def test_evento_inexistente_da_404(self, calcular):
        resposta = self.client.get(url(uuid.uuid4()), PARAMS)
        self.assertEqual(resposta.status_code, 404)

        resposta = self.client.get("/api/rotas/eventos/abc/", PARAMS)
        self.assertEqual(resposta.status_code, 404)
        calcular.assert_not_called()

    def test_evento_inexistente_da_404_mesmo_sem_parametros(self, calcular):
        for parametros in ({}, {"modo": "onibus"}):
            with self.subTest(parametros=parametros):
                resposta = self.client.get(url(uuid.uuid4()), parametros)

                self.assertEqual(resposta.status_code, 404)

    def test_local_sem_coordenadas_da_422(self, calcular):
        sem_local = Evento.objects.create(
            titulo="S", data_inicio=date(2026, 11, 20)
        )
        sem_latitude = Evento.objects.create(
            titulo="L",
            data_inicio=date(2026, 11, 20),
            local=Local.objects.create(
                nome="A", longitude=Decimal("-46.655900")
            ),
        )
        sem_longitude = Evento.objects.create(
            titulo="G",
            data_inicio=date(2026, 11, 20),
            local=Local.objects.create(
                nome="B", latitude=Decimal("-23.561500")
            ),
        )
        for evento in (sem_local, sem_latitude, sem_longitude):
            with self.subTest(evento=evento.titulo):
                resposta = self.get(evento)

                self.assertEqual(resposta.status_code, 422)
                self.assertEqual(resposta.json(), LOCAL_SEM_COORDENADAS)
        calcular.assert_not_called()

    def test_local_na_coordenada_zero_e_valido(self, calcular):
        self.local.latitude = Decimal("0.000000")
        self.local.longitude = Decimal("0.000000")
        self.local.save()

        resposta = self.get(latitude=0.05, longitude=0.05)

        self.assertEqual(resposta.status_code, 200)
        calcular.assert_called_once_with("carro", (0.05, 0.05), (0.0, 0.0))

    def test_destino_fora_da_via_da_422_e_fica_no_cache(self, calcular):
        calcular.return_value = None

        primeira = self.get()
        segunda = self.get()

        self.assertEqual(primeira.status_code, 422)
        self.assertEqual(primeira.json(), LOCAL_FORA_DO_MAPA)
        self.assertEqual(segunda.status_code, 422)
        calcular.assert_called_once()

    def test_erro_do_osrm_da_502_e_nao_vai_para_o_cache(self, calcular):
        calcular.side_effect = [ErroOSRM("tempo esgotado"), [ROTA]]

        with self.assertLogs("rotas.views", "WARNING") as logs:
            primeira = self.get()
        segunda = self.get()

        self.assertEqual(primeira.status_code, 502)
        self.assertEqual(primeira.json(), ERRO_ROTA)
        self.assertNotIn("tempo esgotado", primeira.content.decode())
        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(calcular.call_count, 2)
        (linha,) = logs.output
        self.assertIn("OSRM falhou: tempo esgotado", linha)
        self.assertNotIn("23.58", linha)

    def test_rotas_ficam_fora_do_cache_padrao(self, calcular):
        self.get()
        cache.clear()

        self.get()

        calcular.assert_called_once()

    def test_cache_separa_modo_e_reaproveita_origem_proxima(self, calcular):
        self.get(latitude=-23.58741)
        self.get(latitude=-23.58744)
        self.assertEqual(calcular.call_count, 1)

        self.get(latitude=-23.58744, modo="a_pe")
        self.assertEqual(calcular.call_count, 2)

    def test_editar_local_muda_a_chave(self, calcular):
        self.get()
        self.local.latitude = Decimal("-23.561600")
        self.local.save()

        self.get()

        self.assertEqual(calcular.call_count, 2)
        self.assertEqual(calcular.call_args.args[2], (-23.5616, -46.6559))


class RotasDoCacheTest(SimpleTestCase):
    def setUp(self):
        caches["rotas"].clear()

    def consulta_presa(self, chave):
        """Começa uma consulta de `chave` que só termina no fim do teste."""
        dentro = threading.Event()
        liberar = threading.Event()

        def calcular():
            dentro.set()
            liberar.wait(5)
            return [ROTA]

        primeira = threading.Thread(
            target=_rotas_do_cache, args=(chave, calcular)
        )
        primeira.start()
        self.addCleanup(primeira.join, 5)
        self.addCleanup(liberar.set)
        self.assertTrue(dentro.wait(5))

    def test_pedido_igual_recebe_a_falha_sem_consultar_de_novo(self):
        dentro = threading.Event()
        liberar = threading.Event()
        chamadas = []
        falhas = []

        def calcular():
            chamadas.append(1)
            dentro.set()
            liberar.wait(5)
            raise ErroOSRM("tempo esgotado")

        def pedir():
            try:
                _rotas_do_cache("osrm:f", calcular)
            except ErroOSRM as erro:
                falhas.append(str(erro))

        primeira = threading.Thread(target=pedir)
        primeira.start()
        self.assertTrue(dentro.wait(5))
        segunda = threading.Thread(target=pedir)
        segunda.start()
        segunda.join(0.2)
        self.assertTrue(segunda.is_alive())
        liberar.set()
        primeira.join(5)
        segunda.join(5)

        self.assertEqual(len(chamadas), 1)
        self.assertEqual(falhas, ["tempo esgotado"] * 2)

    def test_chaves_diferentes_nao_esperam_uma_a_outra(self):
        self.consulta_presa("osrm:presa")
        resultados = []

        def pedir_outras():
            for i in range(200):
                resultados.append(
                    _rotas_do_cache(f"osrm:outra:{i}", lambda i=i: [i])
                )

        outras = threading.Thread(target=pedir_outras)
        outras.start()
        outras.join(1)

        self.assertFalse(outras.is_alive())
        self.assertEqual(resultados, [[i] for i in range(200)])

    @patch("rotas.views.PRAZO_OSRM", 0.1)
    def test_pedido_igual_desiste_depois_do_prazo(self):
        self.consulta_presa("osrm:lenta")
        chamadas = []

        with self.assertRaises(ErroOSRM):
            _rotas_do_cache("osrm:lenta", lambda: chamadas.append(1))
        self.assertEqual(chamadas, [])

    def test_pedidos_iguais_ao_mesmo_tempo_calculam_uma_vez(self):
        dentro = threading.Event()
        liberar = threading.Event()
        chamadas = []
        resultados = []

        def calcular():
            chamadas.append(1)
            dentro.set()
            liberar.wait(5)
            return [ROTA]

        def pedir():
            resultados.append(_rotas_do_cache("osrm:k", calcular))

        primeira = threading.Thread(target=pedir)
        primeira.start()
        self.assertTrue(dentro.wait(5))
        segunda = threading.Thread(target=pedir)
        segunda.start()
        segunda.join(0.2)
        self.assertTrue(segunda.is_alive())
        liberar.set()
        primeira.join(5)
        segunda.join(5)

        self.assertEqual(len(chamadas), 1)
        self.assertEqual(resultados, [[ROTA], [ROTA]])

    def test_none_tambem_fica_no_cache(self):
        chamadas = []

        def calcular():
            chamadas.append(1)

        self.assertIsNone(_rotas_do_cache("osrm:n", calcular))
        self.assertIsNone(_rotas_do_cache("osrm:n", calcular))
        self.assertEqual(len(chamadas), 1)
