import copy
import json
from datetime import UTC, datetime
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import OperationalError
from django.test import TestCase, override_settings

from catalogo.importacao import importar
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


class ImportarTest(TestCase):
    def test_cria_eventos_e_locais(self):
        resumo = importar(eventos_da_fixture(), AGORA)
        self.assertEqual(resumo.criados, 11)
        self.assertEqual(resumo.ignorados, 0)
        self.assertEqual(Evento.objects.count(), 11)
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
        self.assertEqual((resumo.criados, resumo.atualizados), (0, 11))
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

    def test_titulo_ou_local_com_a_palavra_teste_e_importado(self):
        importar(eventos_da_fixture(), AGORA)
        self.assertTrue(tm(titulo="TESTE PORTAL"))
        self.assertTrue(tm(titulo="Evento Teste - 2025"))

    def test_marcado_como_test_e_ignorado(self):
        eventos = eventos_da_fixture()
        achar(eventos, "Mink Slide")["test"] = True
        resumo = importar(eventos, AGORA)
        self.assertEqual(resumo.ignorados, 1)
        self.assertFalse(Evento.objects.filter(titulo="Mink Slide").exists())

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

    def test_evento_sem_data_local_e_ignorado_e_resto_importa(self):
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
        del ruim["dates"]["start"]["localDate"]
        resumo = importar(eventos, AGORA)
        self.assertEqual(resumo.criados, 10)
        self.assertEqual(resumo.ignorados, 1)
        self.assertEqual(len(resumo.com_erro), 1)
        self.assertIn("BTS WORLD TOUR ARIRANG", resumo.com_erro[0])
        self.assertIn(ruim["id"], resumo.com_erro[0])
        self.assertFalse(
            Evento.objects.filter(titulo="BTS WORLD TOUR ARIRANG").exists()
        )

    def test_evento_com_erro_que_existia_e_removido(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
        del ruim["dates"]["start"]["localDate"]
        importar(eventos, DEPOIS)
        self.assertEqual(
            tm(titulo="BTS WORLD TOUR ARIRANG").removido_em, DEPOIS
        )

    def test_erro_nao_deixa_gravacao_parcial(self):
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
        ruim["images"] = [{"ratio": "16_9"}]
        importar(eventos, AGORA)
        self.assertFalse(
            Evento.objects.filter(titulo="BTS WORLD TOUR ARIRANG").exists()
        )

    def test_campo_opcional_nulo_nao_impede_a_importacao(self):
        casos = {
            "name": lambda e: e.update(name=None),
            "info": lambda e: e.update(info=None),
            "pleaseNote": lambda e: e.update(pleaseNote=None),
            "url": lambda e: e.update(url=None),
            "dates.status": lambda e: e["dates"].update(status=None),
            "dates.timezone": lambda e: e["dates"].update(timezone=None),
            "classifications": lambda e: e.update(classifications=None),
            "images": lambda e: e.update(images=None),
            "priceRanges": lambda e: e.update(priceRanges=None),
            "_embedded": lambda e: e.update(_embedded=None),
            "venue.name": lambda e: e["_embedded"]["venues"][0].update(
                name=None
            ),
            "venue.address": lambda e: e["_embedded"]["venues"][0].update(
                address=None
            ),
            "venue.city": lambda e: e["_embedded"]["venues"][0].update(
                city=None
            ),
            "venue.state": lambda e: e["_embedded"]["venues"][0].update(
                state=None
            ),
            "venue.country": lambda e: e["_embedded"]["venues"][0].update(
                country=None
            ),
            "venue.location": lambda e: e["_embedded"]["venues"][0].update(
                location=None
            ),
        }
        for nome, alterar in casos.items():
            with self.subTest(campo=nome):
                evento = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
                alterar(evento)
                resumo = importar([evento], AGORA)
                self.assertEqual(resumo.com_erro, [])
                self.assertTrue(tm(id_externo=evento["id"]))

    def test_null_em_info_vira_texto_vazio(self):
        evento = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        evento["info"] = None
        importar([evento], AGORA)
        self.assertEqual(tm(id_externo=evento["id"]).descricao, "")

    def test_dado_invalido_vai_para_com_erro_e_resto_importa(self):
        def venue(evento):
            return evento["_embedded"]["venues"][0]

        casos = {
            "preço inválido": lambda e: e.update(priceRanges=[{"min": "abc"}]),
            "latitude inválida": lambda e: venue(e)["location"].update(
                latitude="N/A"
            ),
            "imagem sem url": lambda e: e.update(images=[{"url": None}]),
            "dates nulo": lambda e: e.update(dates=None),
            "dates.start nulo": lambda e: e["dates"].update(start=None),
        }
        for nome, alterar in casos.items():
            with self.subTest(caso=nome):
                Evento.objects.all().delete()
                eventos = eventos_da_fixture()
                alterar(achar(eventos, "BTS WORLD TOUR ARIRANG"))
                resumo = importar(eventos, AGORA)
                self.assertEqual(resumo.criados, 10)
                self.assertEqual(len(resumo.com_erro), 1)
                self.assertIn("BTS WORLD TOUR ARIRANG", resumo.com_erro[0])
                self.assertFalse(
                    Evento.objects.filter(
                        titulo="BTS WORLD TOUR ARIRANG"
                    ).exists()
                )

    def test_problema_do_banco_interrompe_a_importacao(self):
        with (
            patch(
                "catalogo.importacao._salvar_evento",
                side_effect=OperationalError("database is locked"),
            ),
            self.assertRaises(OperationalError),
        ):
            importar(eventos_da_fixture(), AGORA)

    def test_fuso_desconhecido_e_ignorado(self):
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
        ruim["dates"]["timezone"] = "Marte/Olimpo"
        resumo = importar(eventos, AGORA)
        self.assertEqual(len(resumo.com_erro), 1)
        self.assertEqual(resumo.criados, 10)

    def test_venue_sem_location_importa_sem_coordenadas(self):
        eventos = copy.deepcopy(eventos_da_fixture())
        bts = achar(eventos, "BTS WORLD TOUR ARIRANG")
        del bts["_embedded"]["venues"][0]["location"]
        resumo = importar([bts], AGORA)
        self.assertEqual(resumo.criados, 1)
        local = tm(titulo="BTS WORLD TOUR ARIRANG").local
        self.assertIsNone(local.latitude)
        self.assertIsNone(local.longitude)


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
    def test_zero_eventos_nao_remove_nada(self, _sleep):
        existente = Evento.objects.create(
            provedor=Provedor.TICKETMASTER,
            id_externo="velho",
            titulo="Velho",
            data_inicio=AGORA.date(),
        )
        with (
            patch(
                "catalogo.ticketmaster.buscar_pagina",
                return_value=_pagina(0, 1, []),
            ),
            self.assertRaisesMessage(CommandError, "nenhum evento"),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())
        existente.refresh_from_db()
        self.assertIsNone(existente.removido_em)

    @patch("catalogo.ticketmaster.time.sleep")
    def test_zero_eventos_sem_ativos_nao_falha(self, _sleep):
        with patch(
            "catalogo.ticketmaster.buscar_pagina",
            return_value=_pagina(0, 1, []),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())

    @patch("catalogo.ticketmaster.time.sleep")
    def test_sucesso_imprime_resumo(self, _sleep):
        saida = StringIO()
        with patch(
            "catalogo.ticketmaster.buscar_pagina",
            return_value=_pagina(0, 1, eventos_da_fixture()),
        ):
            call_command("importar_ticketmaster", stdout=saida)
        self.assertIn("criados: 11", saida.getvalue())
        self.assertIn("Halloween 2026 | Soho House", saida.getvalue())
