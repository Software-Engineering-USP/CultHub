from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework.test import APITestCase

from catalogo.models import Evento, FaixaPreco, ImagemEvento, Local, Provedor
from catalogo.paginacao import PaginacaoEventos
from catalogo.tests.fabrica import criar_evento

SP = ZoneInfo("America/Sao_Paulo")


def hoje():
    return timezone.localdate()


class ContratoDaApiTest(APITestCase):
    """Formato exato das respostas, como o front vai consumir."""

    def setUp(self):
        local = Local.objects.create(
            provedor=Provedor.TICKETMASTER,
            id_externo="venue-1",
            nome="Teatro Municipal",
            endereco="Praça Ramos de Azevedo, s/n",
            cidade="São Paulo",
            estado="SP",
            latitude=Decimal("-23.545000"),
            longitude=Decimal("-46.638000"),
        )
        self.evento = criar_evento(
            categorias=["music", "theater"],
            provedor=Provedor.TICKETMASTER,
            id_externo="evento-1",
            titulo="Ópera",
            descricao="Sobre a ópera",
            avisos="Chegue cedo",
            url_externa="https://ingressos.test/opera",
            situacao="onsale",
            local=local,
            data_inicio=date(2040, 3, 10),
            hora_inicio=time(20, 0),
            data_fim=date(2040, 3, 11),
            hora_fim=time(22, 30),
            gratuito=True,
            genero="Opera",
        )
        FaixaPreco.objects.create(
            evento=self.evento,
            tipo="standard",
            moeda="USD",
            minimo=Decimal("10.50"),
            maximo=Decimal("20.00"),
        )
        ImagemEvento.objects.create(
            evento=self.evento,
            url="https://img.test/a.jpg",
            proporcao="16_9",
            largura=1024,
            altura=576,
        )
        self.esperado = {
            "id": str(self.evento.id),
            "provedor": "ticketmaster",
            "titulo": "Ópera",
            "descricao": "Sobre a ópera",
            "genero": "Opera",
            "categorias": ["music", "theater"],
            "url_externa": "https://ingressos.test/opera",
            "data_inicio": "2040-03-10",
            "hora_inicio": "20:00:00",
            "inicio": "2040-03-10T20:00:00-03:00",
            "data_fim": "2040-03-11",
            "hora_fim": "22:30:00",
            "fim": "2040-03-11T22:30:00-03:00",
            "fuso": "America/Sao_Paulo",
            "local": {
                "nome": "Teatro Municipal",
                "endereco": "Praça Ramos de Azevedo, s/n",
                "cidade": "São Paulo",
                "estado": "SP",
                "latitude": -23.545,
                "longitude": -46.638,
            },
            "gratuito": True,
            "situacao_preco": "gratuito",
            "faixas_preco": [
                {
                    "tipo": "standard",
                    "moeda": "USD",
                    "minimo": 10.5,
                    "maximo": 20.0,
                }
            ],
            "imagens": [
                {
                    "url": "https://img.test/a.jpg",
                    "proporcao": "16_9",
                    "largura": 1024,
                    "altura": 576,
                }
            ],
            "distancia_km": None,
        }

    def test_listagem(self):
        corpo = self.client.get("/api/eventos/").json()
        self.assertEqual(corpo["results"], [self.esperado])

    def test_detalhe_acrescenta_os_campos_extras(self):
        corpo = self.client.get(f"/api/eventos/{self.evento.id}/").json()
        self.assertEqual(
            corpo,
            {
                **self.esperado,
                "avisos": "Chegue cedo",
                "situacao": "onsale",
                "removido": False,
            },
        )

    def test_distancia_com_filtro_de_raio(self):
        corpo = self.client.get(
            "/api/eventos/?lat=-23.545&lng=-46.638&raio=1"
        ).json()
        self.assertEqual(
            corpo["results"], [{**self.esperado, "distancia_km": 0.0}]
        )

    def test_envelope_da_paginacao(self):
        corpo = self.client.get("/api/eventos/").json()
        self.assertEqual(set(corpo), {"count", "next", "previous", "results"})


class EventoDetalheTest(APITestCase):
    def url(self, evento):
        return f"/api/eventos/{evento.id}/"

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

    def test_fim_mais_tarde_hoje_mantem(self):
        agora = datetime(2026, 11, 20, 15, 0, tzinfo=SP)
        criar_evento(
            titulo="Termina hoje",
            data_inicio=date(2026, 11, 20),
            hora_inicio=time(10, 0),
            data_fim=date(2026, 11, 20),
            hora_fim=time(20, 0),
        )
        with patch("django.utils.timezone.now", return_value=agora):
            self.assertEqual(self.titulos(), ["Termina hoje"])

    def test_numero_de_consultas_nao_cresce_com_os_eventos(self):
        for numero in range(3):
            evento = criar_evento(
                titulo=f"E{numero}", categorias=["music", "art"]
            )
            FaixaPreco.objects.create(evento=evento, minimo=10, maximo=20)
            ImagemEvento.objects.create(
                evento=evento, url="https://x.test/a.jpg"
            )
        # contagem, eventos e os prefetch de categorias, imagens e preços.
        with self.assertNumQueries(5):
            self.assertEqual(len(self.titulos()), 3)

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
            ["grande", "pequena", "nulo"],
        )

    def test_imagens_so_fallback_mantem_fallback(self):
        evento = criar_evento()
        for url, largura in [("fb1", 100), ("fb2", 500)]:
            ImagemEvento.objects.create(
                evento=evento,
                url=f"https://x.test/{url}",
                largura=largura,
                fallback=True,
            )
        imagens = self.client.get("/api/eventos/").json()["results"][0][
            "imagens"
        ]
        self.assertEqual(
            [i["url"].rsplit("/", 1)[1] for i in imagens], ["fb2", "fb1"]
        )

    def test_schema_descreve_os_campos_de_imagens(self):
        schema = self.client.get("/api/schema/?format=json").json()
        componentes = schema["components"]["schemas"]
        for nome in ("Evento", "EventoDetalhe"):
            with self.subTest(componente=nome):
                self.assertEqual(
                    componentes[nome]["properties"]["imagens"]["items"],
                    {"$ref": "#/components/schemas/Imagem"},
                )
        self.assertEqual(
            set(componentes["Imagem"]["properties"]),
            {"url", "proporcao", "largura", "altura"},
        )

    def test_schema_documenta_o_erro_de_filtro(self):
        schema = self.client.get("/api/schema/?format=json").json()
        respostas = schema["paths"]["/api/eventos/"]["get"]["responses"]
        self.assertEqual(
            respostas["400"]["content"]["application/json"]["schema"],
            {
                "type": "object",
                "additionalProperties": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
        )
        self.assertEqual(
            respostas["200"]["content"]["application/json"]["schema"],
            {"$ref": "#/components/schemas/PaginatedEventoList"},
        )

    def test_schema_documenta_a_listagem_e_o_detalhe(self):
        schema = self.client.get("/api/schema/?format=json").json()
        lista = schema["paths"]["/api/eventos/"]["get"]
        self.assertEqual(
            {p["name"] for p in lista["parameters"]},
            {
                "q",
                "categorias",
                "preco",
                "de",
                "ate",
                "lat",
                "lng",
                "raio",
                "page",
                "tamanho",
            },
        )
        componentes = schema["components"]["schemas"]
        self.assertIn("distancia_km", componentes["Evento"]["properties"])
        detalhe = componentes["EventoDetalhe"]["properties"]
        self.assertLessEqual(
            {"avisos", "situacao", "removido", "distancia_km"}, set(detalhe)
        )
        self.assertIn("/api/eventos/{id}/", schema["paths"])
