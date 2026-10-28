import http.client
import io
import urllib.error
from datetime import UTC, datetime
from unittest.mock import patch

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
        self.assertIn("startDateTime=2026-10-28T03%3A00%3A00Z", url)
        self.assertIn("page=2", url)
        self.assertIn("size=200", url)
        self.assertIn("countryCode=BR", url)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 30)

    @override_settings(TICKETMASTER_API_KEY="segredo123")
    def test_erros_de_transporte_viram_erro_sem_segredo(self):
        for falha in (
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
