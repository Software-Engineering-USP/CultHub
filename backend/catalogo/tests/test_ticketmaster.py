import http.client
import io
import urllib.error
from datetime import UTC, datetime
from unittest.mock import call, patch
from urllib.parse import parse_qs, urlsplit

from django.test import SimpleTestCase, override_settings

from catalogo import ticketmaster
from catalogo.ticketmaster import ErroTicketmaster, buscar_todos

INICIO = datetime(2026, 10, 28, 3, 0, tzinfo=UTC)


def _pagina(numero, total_paginas, eventos, total=None):
    pagina = {
        "page": {
            "number": numero,
            "totalPages": total_paginas,
            "totalElements": len(eventos) if total is None else total,
        }
    }
    if eventos:
        pagina["_embedded"] = {"events": eventos}
    return pagina


class BuscarTodosTests(SimpleTestCase):
    @patch("catalogo.ticketmaster.time.sleep")
    def test_junta_todas_as_paginas(self, _sleep):
        paginas = {
            0: _pagina(0, 2, [{"id": "a"}], total=2),
            1: _pagina(1, 2, [{"id": "b"}], total=2),
        }
        chamadas = []

        def falso(pagina, inicio):
            chamadas.append(pagina)
            return paginas[pagina]

        eventos = buscar_todos(INICIO, buscar=falso)
        self.assertEqual([e["id"] for e in eventos], ["a", "b"])
        self.assertEqual(chamadas, [0, 1])

    @patch("catalogo.ticketmaster.time.sleep")
    def test_pagina_sem_embedded(self, _sleep):
        eventos = buscar_todos(
            INICIO, buscar=lambda p, i: _pagina(0, 0, [], total=0)
        )
        self.assertEqual(eventos, [])

    @patch("catalogo.ticketmaster.time.sleep")
    def test_mais_de_mil_falha(self, _sleep):
        with self.assertRaises(ErroTicketmaster):
            buscar_todos(
                INICIO, buscar=lambda p, i: _pagina(0, 6, [], total=1001)
            )

    @patch("catalogo.ticketmaster.time.sleep")
    def test_pausa_so_entre_as_paginas(self, sleep):
        paginas = [_pagina(n, 3, [{"id": str(n)}], total=3) for n in range(3)]
        buscar_todos(INICIO, buscar=lambda p, i: paginas[p], pausa=0.5)
        self.assertEqual(sleep.call_args_list, [call(0.5), call(0.5)])

    @patch("catalogo.ticketmaster.time.sleep")
    def test_pagina_seguinte_vazia_falha(self, _sleep):
        paginas = [_pagina(0, 2, [{"id": "a"}], total=2), {}]
        with self.assertRaises(ErroTicketmaster):
            buscar_todos(INICIO, buscar=lambda p, i: paginas[p])

    @patch("catalogo.ticketmaster.time.sleep")
    def test_pagina_seguinte_sem_eventos_falha(self, _sleep):
        paginas = [
            _pagina(0, 2, [{"id": "a"}], total=2),
            _pagina(1, 2, [], total=2),
        ]
        with self.assertRaises(ErroTicketmaster):
            buscar_todos(INICIO, buscar=lambda p, i: paginas[p])

    @patch("catalogo.ticketmaster.time.sleep")
    def test_duplicata_nao_conta_como_evento_recebido(self, _sleep):
        paginas = [
            _pagina(0, 2, [{"id": "a"}, {"id": "b"}], total=3),
            _pagina(1, 2, [{"id": "b"}], total=3),
        ]
        with self.assertRaises(ErroTicketmaster) as ctx:
            buscar_todos(INICIO, buscar=lambda p, i: paginas[p])
        self.assertIn("2 de 3", str(ctx.exception))

    @patch("catalogo.ticketmaster.time.sleep")
    def test_duplicata_com_todos_os_eventos_passa(self, _sleep):
        paginas = [
            _pagina(0, 2, [{"id": "a"}, {"id": "b"}], total=3),
            _pagina(1, 2, [{"id": "b"}, {"id": "c"}], total=3),
        ]
        eventos = buscar_todos(INICIO, buscar=lambda p, i: paginas[p])
        self.assertEqual({e["id"] for e in eventos}, {"a", "b", "c"})

    def test_evento_sem_id_conta_como_recebido(self):
        # Fica para a importação registrar em `com_erro`.
        sem_id = [{"name": "x"}, {"id": None}, {"id": ["y"]}, None]
        eventos = buscar_todos(
            INICIO, buscar=lambda p, i: _pagina(0, 1, sem_id)
        )
        self.assertEqual(eventos, sem_id)

    def test_embedded_sem_eventos_com_total_zero_vira_lista_vazia(self):
        casos = {
            "embedded nulo": {"_embedded": None},
            "events nulo": {"_embedded": {"events": None}},
            "embedded sem events": {"_embedded": {}},
        }
        for nome, extra in casos.items():
            resposta = {**_pagina(0, 0, [], total=0), **extra}
            with self.subTest(caso=nome):
                eventos = buscar_todos(
                    INICIO, buscar=lambda p, i, r=resposta: r
                )
                self.assertEqual(eventos, [])

    def test_embedded_nulo_com_total_positivo_falha(self):
        resposta = {**_pagina(0, 1, [], total=2), "_embedded": None}
        with self.assertRaises(ErroTicketmaster) as ctx:
            buscar_todos(INICIO, buscar=lambda p, i: resposta)
        self.assertIn("0 de 2", str(ctx.exception))

    def test_embedded_ou_events_de_outro_tipo_falha(self):
        casos = {
            "embedded em texto": {"_embedded": "x"},
            "embedded em lista": {"_embedded": [{"id": "a"}]},
            "events em texto": {"_embedded": {"events": "abc"}},
            "events em objeto": {"_embedded": {"events": {"id": "a"}}},
        }
        for nome, extra in casos.items():
            resposta = {**_pagina(0, 1, [], total=3), **extra}
            with (
                self.subTest(caso=nome),
                self.assertRaises(ErroTicketmaster),
            ):
                buscar_todos(INICIO, buscar=lambda p, i, r=resposta: r)

    def test_resposta_sem_paginacao_valida_falha(self):
        evento = {"_embedded": {"events": [{"id": "a"}]}}
        casos = {
            "sem page": evento,
            "page nulo": {**evento, "page": None},
            "page vazio": {**evento, "page": {}},
            "sem totalPages": {**evento, "page": {"totalElements": 1}},
            "sem totalElements": {**evento, "page": {"totalPages": 1}},
            "total em texto": {
                **evento,
                "page": {"totalElements": "1", "totalPages": 1},
            },
            "total booleano": {
                **evento,
                "page": {"totalElements": True, "totalPages": 1},
            },
            "total negativo": {
                **evento,
                "page": {"totalElements": -1, "totalPages": 1},
            },
            "páginas nulo": {
                **evento,
                "page": {"totalElements": 1, "totalPages": None},
            },
            "lista": [],
        }
        for nome, resposta in casos.items():
            with (
                self.subTest(caso=nome),
                self.assertRaises(ErroTicketmaster),
            ):
                buscar_todos(INICIO, buscar=lambda p, i, r=resposta: r)

    @patch("catalogo.ticketmaster.time.sleep")
    def test_usa_buscar_pagina_resolvido_na_chamada(self, _sleep):
        with patch(
            "catalogo.ticketmaster.buscar_pagina",
            return_value=_pagina(0, 1, [{"id": "x"}]),
        ):
            self.assertEqual(buscar_todos(INICIO), [{"id": "x"}])


class BuscarPaginaTests(SimpleTestCase):
    @override_settings(TICKETMASTER_API_KEY="segredo123")
    def test_erro_http_sem_chave_na_mensagem(self):
        erro_http = urllib.error.HTTPError(
            "https://app.ticketmaster.com/x?apikey=segredo123",
            500,
            "erro",
            {},
            io.BytesIO(b""),
        )
        with (
            patch("urllib.request.urlopen", side_effect=erro_http),
            self.assertRaises(ErroTicketmaster) as ctx,
        ):
            ticketmaster.buscar_pagina(0, INICIO)
        self.assertNotIn("segredo123", str(ctx.exception))
        self.assertIn("500", str(ctx.exception))

    @override_settings(TICKETMASTER_API_KEY="segredo123")
    def test_json_invalido(self):
        resposta = io.BytesIO(b"<html>")
        with (
            patch("urllib.request.urlopen", return_value=resposta),
            self.assertRaises(ErroTicketmaster),
        ):
            ticketmaster.buscar_pagina(0, INICIO)

    @override_settings(
        TICKETMASTER_API_KEY="segredo123", TICKETMASTER_PAIS="BR"
    )
    def test_monta_parametros(self):
        resposta = io.BytesIO(b'{"page": {}}')
        with patch("urllib.request.urlopen", return_value=resposta) as urlopen:
            ticketmaster.buscar_pagina(2, INICIO)
        url = urlopen.call_args.args[0]
        self.assertEqual(
            parse_qs(urlsplit(url).query),
            {
                "apikey": ["segredo123"],
                "countryCode": ["BR"],
                "size": ["200"],
                "page": ["2"],
                "sort": ["date,asc"],
                "startDateTime": ["2026-10-28T03:00:00Z"],
            },
        )
        self.assertTrue(url.startswith(ticketmaster.URL + "?"))
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 30)

    @override_settings(TICKETMASTER_API_KEY="segredo123")
    def test_erros_de_transporte_viram_erro_sem_segredo(self):
        for falha in (
            urllib.error.URLError(ConnectionRefusedError("apikey=segredo123")),
            TimeoutError("apikey=segredo123"),
            ConnectionResetError("https://x?apikey=segredo123"),
            http.client.RemoteDisconnected("apikey=segredo123"),
            http.client.IncompleteRead(b"abc"),
        ):
            with (
                self.subTest(falha=type(falha).__name__),
                patch("urllib.request.urlopen", side_effect=falha),
                self.assertRaises(ErroTicketmaster) as ctx,
            ):
                ticketmaster.buscar_pagina(0, INICIO)
            self.assertNotIn("segredo123", str(ctx.exception))
            self.assertIsNone(ctx.exception.__cause__)
