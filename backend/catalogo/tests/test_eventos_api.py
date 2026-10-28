from datetime import date, datetime, time, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework.test import APITestCase

from catalogo.models import Evento, FaixaPreco, ImagemEvento
from catalogo.paginacao import PaginacaoEventos
from catalogo.tests.fabrica import criar_evento

SP = ZoneInfo("America/Sao_Paulo")


def hoje():
    return timezone.localdate()


class EventoDetalheTest(APITestCase):
    def url(self, evento):
        return f"/api/eventos/{evento.id}/"

    def test_detalhe_campos(self):
        evento = criar_evento(categorias=["music"], avisos="Aviso")
        FaixaPreco.objects.create(evento=evento, minimo=10, maximo=20)
        ImagemEvento.objects.create(evento=evento, url="https://x.test/a.jpg")
        corpo = self.client.get(self.url(evento)).json()
        listagem = self.client.get("/api/eventos/").json()["results"][0]
        self.assertEqual(
            set(corpo), set(listagem) | {"avisos", "situacao", "removido"}
        )
        self.assertEqual(corpo["categorias"], ["music"])
        self.assertEqual(corpo["avisos"], "Aviso")
        self.assertFalse(corpo["removido"])
        self.assertEqual(corpo["local"]["latitude"], -23.561414)
        self.assertEqual(corpo["faixas_preco"][0]["minimo"], 10.0)

    def test_removido_responde_com_flag(self):
        evento = criar_evento(removido_em=timezone.now())
        resposta = self.client.get(self.url(evento))
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.json()["removido"])

    def test_passado_responde(self):
        evento = criar_evento(data_inicio=hoje() - timedelta(days=30))
        self.assertEqual(self.client.get(self.url(evento)).status_code, 200)

    def test_inexistente_404(self):
        resposta = self.client.get(
            "/api/eventos/00000000-0000-0000-0000-000000000000/"
        )
        self.assertEqual(resposta.status_code, 404)

    def test_publico_sem_login(self):
        evento = criar_evento()
        self.client.logout()
        self.assertEqual(self.client.get(self.url(evento)).status_code, 200)


class EventoListagemTest(APITestCase):
    def titulos(self, query=""):
        resposta = self.client.get(f"/api/eventos/{query}")
        self.assertEqual(resposta.status_code, 200)
        return [e["titulo"] for e in resposta.json()["results"]]

    def test_esconde_removido(self):
        criar_evento(titulo="Visível")
        criar_evento(titulo="Removido", removido_em=timezone.now())
        self.assertEqual(self.titulos(), ["Visível"])

    def test_esconde_passado_sem_fim(self):
        criar_evento(titulo="Ontem", data_inicio=hoje() - timedelta(days=1))
        criar_evento(titulo="Hoje", data_inicio=hoje())
        self.assertEqual(self.titulos(), ["Hoje"])

    def test_mostra_o_dia_inteiro_no_fuso_de_sp(self):
        # 22:00 em SP de 20/11 já é 21/11 em UTC.
        agora = datetime(2026, 11, 20, 22, 0, tzinfo=SP)
        criar_evento(
            titulo="Dentro",
            data_inicio=date(2026, 11, 20),
            hora_inicio=time(15, 0),
        )
        criar_evento(titulo="Fora", data_inicio=date(2026, 11, 19))
        with patch("django.utils.timezone.now", return_value=agora):
            self.assertEqual(self.titulos(), ["Dentro"])

    def test_fim_no_futuro_mantem(self):
        criar_evento(
            titulo="Em andamento",
            data_inicio=hoje() - timedelta(days=7),
            data_fim=hoje() + timedelta(days=1),
        )
        self.assertEqual(self.titulos(), ["Em andamento"])

    def test_fim_passado_esconde(self):
        antes = timezone.now().astimezone(SP) - timedelta(hours=1)
        criar_evento(
            titulo="Acabou",
            data_inicio=antes.date() - timedelta(days=1),
            data_fim=antes.date(),
            hora_fim=antes.time(),
        )
        self.assertEqual(self.titulos(), [])

    def test_ordenacao(self):
        d1 = hoje() + timedelta(days=1)
        d2 = hoje() + timedelta(days=2)
        criar_evento(titulo="D2", data_inicio=d2)
        criar_evento(titulo="D1 sem hora", data_inicio=d1)
        criar_evento(titulo="D1 B", data_inicio=d1, hora_inicio=time(20, 0))
        criar_evento(titulo="D1 A", data_inicio=d1, hora_inicio=time(20, 0))
        criar_evento(titulo="D1 cedo", data_inicio=d1, hora_inicio=time(9, 0))
        self.assertEqual(
            self.titulos(),
            ["D1 cedo", "D1 A", "D1 B", "D1 sem hora", "D2"],
        )

    def test_paginacao_padrao_20(self):
        for i in range(25):
            criar_evento(titulo=f"E{i:02}")
        corpo = self.client.get("/api/eventos/").json()
        self.assertEqual(corpo["count"], 25)
        self.assertEqual(len(corpo["results"]), 20)
        self.assertIsNotNone(corpo["next"])

    def test_tamanho(self):
        for i in range(25):
            criar_evento(titulo=f"E{i:02}")
        corpo = self.client.get("/api/eventos/?tamanho=200").json()
        self.assertEqual(len(corpo["results"]), 25)

    def test_tamanho_limitado_a_200(self):
        amanha = hoje() + timedelta(days=1)
        Evento.objects.bulk_create(
            Evento(titulo=f"E{i}", data_inicio=amanha) for i in range(210)
        )
        corpo = self.client.get("/api/eventos/?tamanho=500").json()
        self.assertEqual(PaginacaoEventos.max_page_size, 200)
        self.assertEqual(corpo["count"], 210)
        self.assertEqual(len(corpo["results"]), 200)

    def test_evento_incompleto(self):
        Evento.objects.create(
            titulo="Simples", data_inicio=hoje() + timedelta(days=1)
        )
        evento = self.client.get("/api/eventos/").json()["results"][0]
        self.assertIsNone(evento["local"])
        self.assertEqual(evento["imagens"], [])
        self.assertEqual(evento["faixas_preco"], [])
        self.assertEqual(evento["categorias"], [])
        self.assertIsNone(evento["distancia_km"])

    def test_imagens_ordenadas(self):
        evento = criar_evento()
        for url, largura, fallback in [
            ("fb", 2000, True),
            ("nulo", None, False),
            ("pequena", 100, False),
            ("grande", 800, False),
        ]:
            ImagemEvento.objects.create(
                evento=evento,
                url=f"https://x.test/{url}",
                largura=largura,
                fallback=fallback,
            )
        imagens = self.client.get("/api/eventos/").json()["results"][0][
            "imagens"
        ]
        self.assertEqual(
            [i["url"].rsplit("/", 1)[1] for i in imagens],
            ["grande", "pequena", "nulo", "fb"],
        )

    def test_schema_tem_eventos(self):
        resposta = self.client.get("/api/schema/")
        self.assertIn("/api/eventos/", resposta.content.decode())
