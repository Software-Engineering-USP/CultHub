import copy
import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import OperationalError
from django.test import TestCase, override_settings
from django.utils import timezone

from catalogo import importacao
from catalogo.importacao import ErroImportacao, importar
from catalogo.models import Evento, ImagemEvento, Local, Provedor
from catalogo.ticketmaster import ErroTicketmaster

FIXTURE = Path(__file__).parent / "dados" / "ticketmaster_pagina.json"
AGORA = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)
DEPOIS = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)
# 22h de 29/10 em São Paulo, uma hora depois do início do Samba.
NOITE_DO_SAMBA = datetime(2026, 10, 30, 1, 0, tzinfo=UTC)


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
            e
            for e in eventos_da_fixture()
            if not e["name"].startswith("Carioca")
        ]
        resumo = importar(eventos, DEPOIS)
        self.assertEqual(resumo.removidos, 1)
        self.assertEqual(tm(titulo="Carioca Matsuri 2026").removido_em, DEPOIS)

    def test_evento_que_ja_comecou_e_nao_veio_nao_e_removido(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = [
            e for e in eventos_da_fixture() if not e["name"].startswith("BTS")
        ]
        resumo = importar(eventos, DEPOIS)
        self.assertEqual(resumo.removidos, 0)
        self.assertIsNone(tm(titulo="BTS WORLD TOUR ARIRANG").removido_em)

    def test_evento_de_varios_dias_em_andamento_nao_e_removido(self):
        importar(eventos_da_fixture(), AGORA)
        Evento.objects.filter(titulo="BTS WORLD TOUR ARIRANG").update(
            data_fim=date(2026, 10, 30)
        )
        eventos = [
            e for e in eventos_da_fixture() if not e["name"].startswith("BTS")
        ]
        importar(eventos, DEPOIS)
        self.assertIsNone(tm(titulo="BTS WORLD TOUR ARIRANG").removido_em)

    def test_evento_que_comecou_hoje_mais_cedo_e_voltou_continua(self):
        # Samba começa 29/10 às 21h em SP; a importação roda às 22h.
        importar(eventos_da_fixture(), AGORA)
        resumo = importar(eventos_da_fixture(), NOITE_DO_SAMBA)
        self.assertEqual(resumo.removidos, 0)
        self.assertIsNone(
            tm(titulo="Samba nas Alturas | Sampa Sky").removido_em
        )

    def test_evento_que_comecou_hoje_e_sumiu_e_removido(self):
        # Começou hoje, então estava na janela da busca: sumir é remoção.
        # Em UTC já é 30/10; a data de referência é a de SP (29/10).
        importar(eventos_da_fixture(), AGORA)
        eventos = [
            e
            for e in eventos_da_fixture()
            if not e["name"].startswith("Samba")
        ]
        resumo = importar(eventos, NOITE_DO_SAMBA)
        self.assertEqual(resumo.removidos, 1)
        self.assertEqual(
            tm(titulo="Samba nas Alturas | Sampa Sky").removido_em,
            NOITE_DO_SAMBA,
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

    def test_evento_com_erro_que_existia_fica_com_os_dados_antigos(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
        ruim["images"] = [{"ratio": "16_9"}]
        ruim["info"] = "Novo texto"
        resumo = importar(eventos, DEPOIS)
        self.assertEqual(resumo.removidos, 0)
        self.assertEqual(len(resumo.com_erro), 1)
        evento = tm(titulo="BTS WORLD TOUR ARIRANG")
        self.assertIsNone(evento.removido_em)
        self.assertEqual(evento.sincronizado_em, AGORA)
        self.assertNotEqual(evento.descricao, "Novo texto")

    def test_evento_que_nao_veio_e_removido_mesmo_com_outro_com_erro(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
        ruim["images"] = [{"ratio": "16_9"}]
        eventos.remove(achar(eventos, "Mink Slide"))
        resumo = importar(eventos, DEPOIS)
        self.assertEqual(resumo.removidos, 1)
        self.assertEqual(tm(titulo="Mink Slide").removido_em, DEPOIS)
        self.assertIsNone(tm(titulo="BTS WORLD TOUR ARIRANG").removido_em)

    def test_evento_ja_removido_que_volta_com_erro_continua_removido(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = copy.deepcopy(eventos_da_fixture())
        ruim = achar(eventos, "Carioca Matsuri 2026")
        eventos.remove(ruim)
        importar(eventos, DEPOIS)
        ruim["images"] = [{"ratio": "16_9"}]
        importar([*eventos, ruim], DEPOIS + timedelta(days=1))
        self.assertEqual(tm(titulo="Carioca Matsuri 2026").removido_em, DEPOIS)

    def test_evento_com_erro_e_id_que_nao_e_texto_vai_para_com_erro(self):
        eventos = eventos_da_fixture()
        for id_ruim in (["x"], {"a": 1}, 7, None):
            with self.subTest(id=id_ruim):
                ruim = {"id": id_ruim, "name": "Sem data"}
                resumo = importar([*eventos, ruim], AGORA)
                self.assertEqual(len(resumo.com_erro), 1)

    def test_todos_invalidos_que_ja_existiam_aborta_sem_remover(self):
        importar(eventos_da_fixture(), AGORA)
        ativos = Evento.objects.filter(removido_em__isnull=True).count()
        ruim = copy.deepcopy(
            achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        )
        ruim["images"] = [{"ratio": "16_9"}]
        with self.assertRaises(ErroImportacao):
            importar([ruim], DEPOIS)
        self.assertEqual(
            Evento.objects.filter(removido_em__isnull=True).count(), ativos
        )

    def test_item_que_nao_e_objeto_vai_para_com_erro_e_resto_importa(self):
        for item in (None, "texto", 7, ["x"]):
            with self.subTest(item=item):
                Evento.objects.all().delete()
                resumo = importar([item, *eventos_da_fixture()], AGORA)
                self.assertEqual(resumo.criados, 11)
                self.assertEqual(resumo.ignorados, 1)
                self.assertEqual(len(resumo.com_erro), 1)

    def test_so_itens_que_nao_sao_objeto_aborta_sem_remover(self):
        importar(eventos_da_fixture(), AGORA)
        with self.assertRaises(ErroImportacao):
            importar([None, None], DEPOIS)
        self.assertFalse(
            Evento.objects.filter(removido_em__isnull=False).exists()
        )

    def test_evento_ja_removido_que_segue_sem_vir_mantem_a_data(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = eventos_da_fixture()
        eventos.remove(achar(eventos, "Mink Slide"))
        importar(eventos, DEPOIS)
        resumo = importar(eventos, DEPOIS + timedelta(days=1))
        self.assertEqual(resumo.removidos, 0)
        self.assertEqual(tm(titulo="Mink Slide").removido_em, DEPOIS)

    def test_item_com_erro_sem_id_nao_remove_quem_faltou(self):
        casos = {
            "null": None,
            "texto": "x",
            "sem id": {"name": "Sem id"},
            "id nulo": {"id": None, "name": "Id nulo"},
            "id vazio": {"id": "", "name": "Id vazio"},
            "id lista": {"id": ["x"], "name": "Id lista"},
            "id número": {"id": 7, "name": "Id número"},
        }
        importar(eventos_da_fixture(), AGORA)
        eventos = eventos_da_fixture()
        faltou = eventos.pop()
        for nome, item in casos.items():
            with self.subTest(caso=nome):
                resumo = importar([*eventos, item], DEPOIS)
                self.assertEqual(resumo.atualizados, 10)
                self.assertEqual(len(resumo.com_erro), 1)
                self.assertEqual(resumo.removidos, 0)
                self.assertTrue(resumo.remocao_pulada)
                self.assertIsNone(tm(id_externo=faltou["id"]).removido_em)

    def test_ignorado_sem_id_nao_impede_a_remocao(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = eventos_da_fixture()
        eventos.pop()
        casos = {
            "cancelado": {"dates": {"status": {"code": "cancelled"}}},
            "de teste": {"test": True},
        }
        for nome, item in casos.items():
            with self.subTest(caso=nome):
                resumo = importar([*eventos, item], DEPOIS)
                self.assertEqual(resumo.com_erro, [])
                self.assertFalse(resumo.remocao_pulada)
                self.assertEqual(
                    Evento.objects.filter(removido_em=DEPOIS).count(), 1
                )

    def test_erro_com_id_em_texto_nao_pula_a_remocao(self):
        importar(eventos_da_fixture(), AGORA)
        eventos = copy.deepcopy(eventos_da_fixture())
        achar(eventos, "BTS WORLD TOUR ARIRANG")["images"] = [{"ratio": "1"}]
        eventos.remove(achar(eventos, "Mink Slide"))
        resumo = importar(eventos, DEPOIS)
        self.assertFalse(resumo.remocao_pulada)
        self.assertEqual(resumo.removidos, 1)

    def test_evento_valido_com_id_invalido_vai_para_com_erro(self):
        for id_ruim in (["x"], {"a": 1}, 7, ""):
            with self.subTest(id=id_ruim):
                Evento.objects.all().delete()
                eventos = eventos_da_fixture()
                achar(eventos, "BTS WORLD TOUR ARIRANG")["id"] = id_ruim
                resumo = importar(eventos, AGORA)
                self.assertEqual(resumo.criados, 10)
                self.assertEqual(len(resumo.com_erro), 1)
                self.assertIn("BTS WORLD TOUR ARIRANG", resumo.com_erro[0])
                self.assertFalse(
                    Evento.objects.filter(
                        titulo="BTS WORLD TOUR ARIRANG"
                    ).exists()
                )

    def test_problema_do_banco_desfaz_o_que_ja_foi_gravado(self):
        original = importacao._salvar_evento
        chamadas = []

        def falha_no_segundo(dados, agora):
            chamadas.append(dados)
            if len(chamadas) == 2:
                raise OperationalError("database is locked")
            return original(dados, agora)

        with (
            patch(
                "catalogo.importacao._salvar_evento",
                side_effect=falha_no_segundo,
            ),
            self.assertRaises(OperationalError),
        ):
            importar(eventos_da_fixture(), AGORA)
        self.assertEqual(Evento.objects.count(), 0)

    def test_todos_invalidos_aborta_sem_remover(self):
        importar(eventos_da_fixture(), AGORA)
        ativos = Evento.objects.filter(removido_em__isnull=True).count()
        invalidos = [{"id": "novo-1", "name": "Sem data"}]
        with self.assertRaises(ErroImportacao):
            importar(invalidos, DEPOIS)
        self.assertEqual(
            Evento.objects.filter(removido_em__isnull=True).count(), ativos
        )

    def test_cancelados_e_invalidos_sem_validos_aborta_sem_remover(self):
        importar(eventos_da_fixture(), AGORA)
        ativos = Evento.objects.filter(removido_em__isnull=True).count()
        eventos = [
            {
                "id": "c",
                "name": "C",
                "dates": {"status": {"code": "cancelled"}},
            },
            {"id": "novo-1", "name": "Sem data"},
        ]
        with self.assertRaises(ErroImportacao):
            importar(eventos, DEPOIS)
        self.assertEqual(
            Evento.objects.filter(removido_em__isnull=True).count(), ativos
        )

    def test_todos_cancelados_sem_erro_continua_removendo(self):
        importar(eventos_da_fixture(), AGORA)
        ativos = Evento.objects.filter(
            removido_em__isnull=True, data_inicio__gte=DEPOIS.date()
        ).count()
        cancelados = eventos_da_fixture()
        for evento in cancelados:
            evento["dates"]["status"]["code"] = "cancelled"
        resumo = importar(cancelados, DEPOIS)
        self.assertEqual(resumo.removidos, ativos)
        self.assertFalse(
            Evento.objects.filter(
                removido_em__isnull=True, data_inicio__gte=DEPOIS.date()
            ).exists()
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

    def test_evento_sem_titulo_vai_para_com_erro(self):
        casos = {
            "ausente": lambda e: e.pop("name"),
            "nulo": lambda e: e.update(name=None),
            "vazio": lambda e: e.update(name=""),
            "só espaços": lambda e: e.update(name="   "),
        }
        for nome, alterar in casos.items():
            with self.subTest(caso=nome):
                Evento.objects.all().delete()
                eventos = eventos_da_fixture()
                ruim = achar(eventos, "BTS WORLD TOUR ARIRANG")
                alterar(ruim)
                resumo = importar(eventos, AGORA)
                self.assertEqual(resumo.criados, 10)
                self.assertEqual(
                    resumo.com_erro,
                    [f"{ruim['id']}: {ruim.get('name') or '?'}"],
                )
                self.assertFalse(
                    Evento.objects.filter(id_externo=ruim["id"]).exists()
                )

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
            "latitude NaN": lambda e: venue(e)["location"].update(
                latitude="NaN"
            ),
            "longitude infinita": lambda e: venue(e)["location"].update(
                longitude="Infinity"
            ),
            "preço NaN": lambda e: e.update(priceRanges=[{"min": "NaN"}]),
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

    def test_campos_do_evento_vem_do_json(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        dados["info"] = "Sobre o show"
        dados["pleaseNote"] = "Chegue cedo"
        dados["url"] = "https://ingressos.test/bts"
        dados["dates"]["status"]["code"] = "offsale"
        importar([dados], AGORA)
        evento = tm(id_externo=dados["id"])
        self.assertEqual(evento.descricao, "Sobre o show")
        self.assertEqual(evento.avisos, "Chegue cedo")
        self.assertEqual(evento.url_externa, "https://ingressos.test/bts")
        self.assertEqual(evento.situacao, "offsale")
        self.assertEqual(evento.classificacoes, dados["classifications"])
        self.assertEqual(evento.genero, "Pop")
        self.assertEqual(evento.sincronizado_em, AGORA)

    def test_campos_do_local_vem_do_json(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        venue = dados["_embedded"]["venues"][0]
        venue.update(
            name="Estádio",
            address={"line1": "Rua A, 1"},
            city={"name": "São Paulo"},
            state={"stateCode": "SP"},
            country={"countryCode": "AR"},
            location={"latitude": "-23.5", "longitude": "-46.6"},
        )
        importar([dados], AGORA)
        local = Local.objects.get(id_externo=venue["id"])
        self.assertEqual(local.provedor, Provedor.TICKETMASTER)
        self.assertEqual(local.nome, "Estádio")
        self.assertEqual(local.endereco, "Rua A, 1")
        self.assertEqual(local.cidade, "São Paulo")
        self.assertEqual(local.estado, "SP")
        self.assertEqual(local.pais, "AR")
        self.assertEqual(local.latitude, Decimal("-23.5"))
        self.assertEqual(local.longitude, Decimal("-46.6"))

    def test_faixa_de_preco_completa(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        dados["priceRanges"] = [
            {"type": "vip", "currency": "USD", "min": 10.5, "max": "99.90"},
            {},
        ]
        importar([dados], AGORA)
        evento = tm(id_externo=dados["id"])
        self.assertCountEqual(
            evento.faixas_preco.values_list(
                "tipo", "moeda", "minimo", "maximo"
            ),
            [
                ("vip", "USD", Decimal("10.50"), Decimal("99.90")),
                ("", "BRL", None, None),
            ],
        )

    def test_imagem_completa(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        dados["images"] = [
            {
                "url": "https://img.test/a.jpg",
                "ratio": "16_9",
                "width": 1024,
                "height": 576,
                "fallback": True,
            },
            {"url": "https://img.test/b.jpg"},
        ]
        importar([dados], AGORA)
        evento = tm(id_externo=dados["id"])
        self.assertCountEqual(
            evento.imagens.values_list(
                "url", "proporcao", "largura", "altura", "fallback"
            ),
            [
                ("https://img.test/a.jpg", "16_9", 1024, 576, True),
                ("https://img.test/b.jpg", "", None, None, False),
            ],
        )

    def test_hora_a_definir_fica_nula(self):
        for chave in ("timeTBA", "noSpecificTime"):
            with self.subTest(chave=chave):
                dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
                inicio = dados["dates"]["start"]
                inicio.update(localTime="20:00:00", timeTBA=False)
                inicio.update(noSpecificTime=False)
                inicio[chave] = True
                importar([dados], AGORA)
                evento = tm(id_externo=dados["id"])
                self.assertIsNone(evento.hora_inicio)
                self.assertIsNone(evento.inicio)

    def test_fuso_vem_do_evento_depois_do_local_depois_do_padrao(self):
        casos = (
            ("America/Manaus", "America/Recife", "America/Manaus"),
            (None, "America/Recife", "America/Recife"),
            (None, None, "America/Sao_Paulo"),
        )
        for do_evento, do_local, esperado in casos:
            with self.subTest(do_evento=do_evento, do_local=do_local):
                dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
                dados["dates"]["timezone"] = do_evento
                dados["_embedded"]["venues"][0]["timezone"] = do_local
                importar([dados], AGORA)
                self.assertEqual(tm(id_externo=dados["id"]).fuso, esperado)

    def test_reimportar_substitui_categorias(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        importar([dados], AGORA)
        dados["classifications"] = [{"segment": {"name": "Sports"}}]
        importar([dados], DEPOIS)
        evento = tm(id_externo=dados["id"])
        self.assertEqual(
            set(evento.categorias.values_list("codigo", flat=True)), {"sport"}
        )

    def test_reimportar_substitui_faixas_de_preco(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        dados["priceRanges"] = [{"min": 10}, {"min": 20}]
        importar([dados], AGORA)
        dados["priceRanges"] = [{"min": 30}]
        importar([dados], DEPOIS)
        evento = tm(id_externo=dados["id"])
        self.assertEqual(
            list(evento.faixas_preco.values_list("minimo", flat=True)),
            [Decimal("30.00")],
        )

    def test_reimportar_substitui_imagens(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        dados["images"] = [{"url": "https://img.test/velha.jpg"}]
        importar([dados], AGORA)
        dados["images"] = [{"url": "https://img.test/nova.jpg"}]
        importar([dados], DEPOIS)
        evento = tm(id_externo=dados["id"])
        self.assertEqual(
            list(evento.imagens.values_list("url", flat=True)),
            ["https://img.test/nova.jpg"],
        )

    def test_reimportar_atualiza_o_local_sem_duplicar(self):
        dados = achar(eventos_da_fixture(), "BTS WORLD TOUR ARIRANG")
        importar([dados], AGORA)
        venue = dados["_embedded"]["venues"][0]
        venue["name"] = "Nome novo"
        importar([dados], DEPOIS)
        self.assertEqual(Local.objects.count(), 1)
        self.assertEqual(tm(id_externo=dados["id"]).local.nome, "Nome novo")

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
    def test_pagina_seguinte_vazia_nao_grava_nem_remove(self, _sleep):
        existente = Evento.objects.create(
            provedor=Provedor.TICKETMASTER,
            id_externo="velho",
            titulo="Velho",
            data_inicio=AGORA.date(),
        )
        eventos = eventos_da_fixture()
        primeira = _pagina(0, 2, eventos[:2])
        primeira["page"]["totalElements"] = len(eventos)

        def falso(pagina, inicio):
            return primeira if pagina == 0 else {}

        with (
            patch("catalogo.ticketmaster.buscar_pagina", side_effect=falso),
            self.assertRaises(CommandError),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())
        self.assertEqual(Evento.objects.count(), 1)
        existente.refresh_from_db()
        self.assertIsNone(existente.removido_em)

    @patch("catalogo.ticketmaster.time.sleep")
    def test_paginas_com_duplicata_nao_removem_o_que_faltou(self, _sleep):
        eventos = eventos_da_fixture()[:3]
        importar(eventos, AGORA)
        a, b, c = eventos
        primeira = _pagina(0, 2, [a, b])
        primeira["page"]["totalElements"] = 3
        segunda = _pagina(1, 2, [b])
        segunda["page"]["totalElements"] = 3

        with (
            patch(
                "catalogo.ticketmaster.buscar_pagina",
                side_effect=[primeira, segunda],
            ),
            self.assertRaises(CommandError),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())
        self.assertIsNone(tm(id_externo=c["id"]).removido_em)

    def test_item_sem_id_nao_remove_e_avisa_no_resumo(self):
        eventos = eventos_da_fixture()[:3]
        importar(eventos, AGORA)
        a, b, c = eventos
        saida = StringIO()
        with patch(
            "catalogo.ticketmaster.buscar_pagina",
            return_value=_pagina(0, 1, [a, b, None]),
        ):
            call_command("importar_ticketmaster", stdout=saida)
        self.assertIn("removidos: 0", saida.getvalue())
        self.assertIn("nenhum evento foi removido", saida.getvalue())
        self.assertIsNone(tm(id_externo=c["id"]).removido_em)

    def test_resposta_sem_paginacao_nao_remove(self):
        eventos = eventos_da_fixture()[:3]
        importar(eventos, AGORA)
        resposta = {"_embedded": {"events": eventos[:1]}}
        with (
            patch(
                "catalogo.ticketmaster.buscar_pagina", return_value=resposta
            ),
            self.assertRaises(CommandError),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())
        self.assertEqual(
            Evento.objects.filter(removido_em__isnull=True).count(), 3
        )

    def test_busca_desde_o_comeco_do_dia_em_sp(self):
        # 22:00 de 28/10 em SP, já 29/10 em UTC.
        agora = datetime(2026, 10, 29, 1, 0, tzinfo=UTC)
        with (
            patch("django.utils.timezone.now", return_value=agora),
            patch(
                "catalogo.ticketmaster.buscar_pagina",
                return_value=_pagina(0, 1, []),
            ) as buscar,
        ):
            call_command("importar_ticketmaster", stdout=StringIO())
        self.assertEqual(
            buscar.call_args.args[1],
            datetime(2026, 10, 28, 3, 0, tzinfo=UTC),
        )

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
    def test_todos_invalidos_falha_e_nao_remove(self, _sleep):
        existente = Evento.objects.create(
            provedor=Provedor.TICKETMASTER,
            id_externo="velho",
            titulo="Velho",
            data_inicio=AGORA.date(),
        )
        invalidos = [{"id": "novo-1", "name": "Sem data"}]
        with (
            patch(
                "catalogo.ticketmaster.buscar_pagina",
                return_value=_pagina(0, 1, invalidos),
            ),
            self.assertRaises(CommandError),
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

    def test_resumo_traz_todas_as_contagens(self):
        eventos = eventos_da_fixture()
        bom = achar(eventos, "BTS WORLD TOUR ARIRANG")
        sem_categoria = achar(eventos, "Halloween 2026 | Soho House")
        de_teste = achar(eventos, "Mink Slide")
        de_teste["test"] = True
        ruim = achar(eventos, "TESTE PORTAL")
        del ruim["dates"]["start"]["localDate"]
        importar([bom], AGORA)
        Evento.objects.create(
            provedor=Provedor.TICKETMASTER,
            id_externo="velho",
            titulo="Velho",
            data_inicio=timezone.localdate(),
        )
        saida = StringIO()
        with patch(
            "catalogo.ticketmaster.buscar_pagina",
            return_value=_pagina(0, 1, [bom, sem_categoria, de_teste, ruim]),
        ):
            call_command("importar_ticketmaster", stdout=saida)
        self.assertEqual(
            saida.getvalue().splitlines(),
            [
                "criados: 1",
                "atualizados: 1",
                "removidos: 1",
                "ignorados: 2",
                "sem categoria: 1",
                "  - Halloween 2026 | Soho House",
                "com erro: 1",
                f"  - {ruim['id']}: TESTE PORTAL",
            ],
        )
