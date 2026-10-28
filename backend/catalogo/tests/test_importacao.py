import copy
import json
from datetime import UTC, datetime
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from catalogo.importacao import eh_evento_de_teste, importar
from catalogo.models import Evento, ImagemEvento, Local, Provedor
from catalogo.ticketmaster import ErroTicketmaster

FIXTURE = Path(__file__).parent / "dados" / "ticketmaster_pagina.json"
AGORA = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)
DEPOIS = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)


def eventos_da_fixture():
    with FIXTURE.open(encoding="utf-8") as arquivo:
        return json.load(arquivo)["_embedded"]["events"]


def achar(eventos, nome):
    return next(e for e in eventos if e["name"] == nome)


def tm(**filtros):
    return Evento.objects.get(provedor=Provedor.TICKETMASTER, **filtros)


class EhEventoDeTesteTest(TestCase):
    def test_marcador_e_nomes(self):
        self.assertTrue(eh_evento_de_teste({"test": True}))
        self.assertTrue(eh_evento_de_teste({"name": "Evento Teste - 2025"}))
        self.assertTrue(eh_evento_de_teste({"name": "TESTE PORTAL"}))
        self.assertTrue(
            eh_evento_de_teste(
                {"name": "X", "_embedded": {"venues": [{"name": "Test"}]}}
            )
        )
        self.assertFalse(eh_evento_de_teste({"name": "Contestetico"}))
        self.assertFalse(eh_evento_de_teste({"name": "BTS"}))


class ImportarTest(TestCase):
    def test_cria_eventos_e_locais(self):
        resumo = importar(eventos_da_fixture(), AGORA)
        self.assertEqual(resumo.criados, 9)
        self.assertEqual(resumo.ignorados, 2)
        self.assertEqual(Evento.objects.count(), 9)
        bts = tm(titulo="BTS WORLD TOUR ARIRANG")
        self.assertEqual(bts.data_inicio.isoformat(), "2026-10-28")
        self.assertEqual(bts.hora_inicio.isoformat(), "20:00:00")
        self.assertEqual(bts.inicio, datetime(2026, 10, 28, 23, 0, tzinfo=UTC))
        self.assertTrue(bts.url_externa)
        self.assertEqual(bts.local.nome, "MorumBis")
        self.assertEqual(bts.local.estado, "SP")
        self.assertEqual(bts.local.endereco, "")
        self.assertEqual(bts.local.cidade, "")
        bts.local.refresh_from_db()
        self.assertEqual(bts.local.latitude, Decimal("-23.600265"))
        self.assertEqual(
            set(bts.categorias.values_list("codigo", flat=True)), {"music"}
        )
        self.assertGreater(bts.imagens.count(), 0)

    def test_mink_slide_sem_hora(self):
        importar(eventos_da_fixture(), AGORA)
        mink = tm(titulo="Mink Slide")
        self.assertIsNone(mink.hora_inicio)
        self.assertIsNone(mink.inicio)
        self.assertEqual(mink.data_inicio.isoformat(), "2039-12-31")

    def test_sem_categoria_no_resumo(self):
        resumo = importar(eventos_da_fixture(), AGORA)
        self.assertIn("Halloween 2026 | Soho House", resumo.sem_categoria)

    def test_reimportar_e_idempotente(self):
        importar(eventos_da_fixture(), AGORA)
        antes = (
            Evento.objects.count(),
            Local.objects.count(),
            ImagemEvento.objects.count(),
        )
        resumo = importar(eventos_da_fixture(), DEPOIS)
        self.assertEqual((resumo.criados, resumo.atualizados), (0, 9))
        depois = (
            Evento.objects.count(),
            Local.objects.count(),
            ImagemEvento.objects.count(),
        )
        self.assertEqual(antes, depois)

    def test_atualiza_campos(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = eventos_da_fixture()
        achar(eventos, "BTS WORLD TOUR ARIRANG")["name"] = "BTS Novo"
        importar(eventos, DEPOIS)
        self.assertTrue(Evento.objects.filter(titulo="BTS Novo").exists())
        self.assertFalse(
            Evento.objects.filter(titulo="BTS WORLD TOUR ARIRANG").exists()
        )

    def test_reimportar_recalcula_inicio(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = eventos_da_fixture()
        inicio = achar(eventos, "BTS WORLD TOUR ARIRANG")["dates"]["start"]
        inicio["localDate"] = "2026-11-02"
        inicio["localTime"] = "21:30:00"
        importar(eventos, DEPOIS)
        bts = tm(titulo="BTS WORLD TOUR ARIRANG")
        bts.refresh_from_db()
        self.assertEqual(bts.inicio, datetime(2026, 11, 3, 0, 30, tzinfo=UTC))

    def test_quem_nao_veio_ganha_removido_em(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = [
            e for e in eventos_da_fixture() if not e["name"].startswith("BTS")
        ]
        resumo = importar(eventos, DEPOIS)
        self.assertEqual(resumo.removidos, 1)
        self.assertEqual(
            tm(titulo="BTS WORLD TOUR ARIRANG").removido_em, DEPOIS
        )

    def test_quem_volta_perde_removido_em(self):
        importar(eventos_da_fixture(), AGORA)
        importar([], DEPOIS)
        self.assertIsNotNone(tm(titulo="Mink Slide").removido_em)
        importar(eventos_da_fixture(), DEPOIS)
        self.assertIsNone(tm(titulo="Mink Slide").removido_em)

    def test_cancelado_vira_removido(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = eventos_da_fixture()
        achar(eventos, "Mink Slide")["dates"]["status"]["code"] = "cancelled"
        resumo = importar(eventos, DEPOIS)
        self.assertEqual(resumo.removidos, 1)
        self.assertEqual(tm(titulo="Mink Slide").removido_em, DEPOIS)

    def test_manual_intocado(self):
        manual = Evento.objects.create(
            titulo="Feira local", data_inicio=AGORA.date()
        )
        importar(eventos_da_fixture(), AGORA)
        importar([], DEPOIS)
        manual.refresh_from_db()
        self.assertIsNone(manual.removido_em)
        self.assertEqual(manual.titulo, "Feira local")

    def test_eventos_sem_embedded_venues(self):
        eventos = copy.deepcopy(eventos_da_fixture())
        bts = achar(eventos, "BTS WORLD TOUR ARIRANG")
        bts.pop("_embedded")
        importar([bts], AGORA)
        self.assertIsNone(tm(titulo="BTS WORLD TOUR ARIRANG").local)


def _pagina(numero, total_paginas, eventos):
    return {
        "page": {
            "number": numero,
            "totalPages": total_paginas,
            "totalElements": len(eventos),
        },
        "_embedded": {"events": eventos},
    }


@override_settings(TICKETMASTER_API_KEY="chave-falsa")
class ComandoTest(TestCase):
    def test_sem_chave(self):
        with (
            override_settings(TICKETMASTER_API_KEY=""),
            self.assertRaisesMessage(
                CommandError, "TICKETMASTER_API_KEY não configurada"
            ),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())

    @patch("catalogo.ticketmaster.time.sleep")
    def test_falha_na_pagina_2_nao_grava_nem_remove(self, _sleep):
        existente = Evento.objects.create(
            provedor=Provedor.TICKETMASTER,
            id_externo="velho",
            titulo="Velho",
            data_inicio=AGORA.date(),
        )

        def falso(pagina, inicio):
            if pagina == 0:
                return _pagina(0, 2, eventos_da_fixture())
            raise ErroTicketmaster("falha de rede")

        with (
            patch("catalogo.ticketmaster.buscar_pagina", side_effect=falso),
            self.assertRaises(CommandError),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())
        self.assertEqual(Evento.objects.count(), 1)
        existente.refresh_from_db()
        self.assertIsNone(existente.removido_em)

    @patch("catalogo.ticketmaster.time.sleep")
    def test_sucesso_imprime_resumo(self, _sleep):
        saida = StringIO()
        with patch(
            "catalogo.ticketmaster.buscar_pagina",
            return_value=_pagina(0, 1, eventos_da_fixture()),
        ):
            call_command("importar_ticketmaster", stdout=saida)
        self.assertIn("criados: 9", saida.getvalue())
        self.assertIn("Halloween 2026 | Soho House", saida.getvalue())
