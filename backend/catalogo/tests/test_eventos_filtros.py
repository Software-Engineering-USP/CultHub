from datetime import timedelta
from decimal import Decimal
from typing import ClassVar

from django.utils import timezone
from rest_framework.test import APITestCase

from catalogo.models import Local, Provedor
from catalogo.tests.fabrica import criar_evento


class FiltrosBuscaTest(APITestCase):
    def buscar(self, **params):
        return self.client.get("/api/eventos/", params)

    def titulos(self, **params):
        resposta = self.buscar(**params)
        self.assertEqual(resposta.status_code, 200)
        return sorted(e["titulo"] for e in resposta.json()["results"])

    def test_q_no_titulo_sem_caixa(self):
        criar_evento(titulo="Noite de JAZZ")
        criar_evento(titulo="Outro")
        self.assertEqual(self.titulos(q="jazz"), ["Noite de JAZZ"])

    def test_q_na_descricao(self):
        criar_evento(titulo="A", descricao="Show de Samba")
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(q="samba"), ["A"])

    def test_q_no_nome_do_local(self):
        local = Local.objects.create(
            nome="Teatro Municipal", cidade="São Paulo", estado="SP"
        )
        criar_evento(titulo="A", local=local)
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(q="municipal"), ["A"])

    def test_q_sem_caixa_e_sem_acento(self):
        criar_evento(titulo="Festival em SÃO PAULO")
        criar_evento(titulo="EXPOSIÇÃO de arte")
        criar_evento(titulo="Outro")
        self.assertEqual(
            self.titulos(q="são paulo"), ["Festival em SÃO PAULO"]
        )
        self.assertEqual(
            self.titulos(q="SÃO PAULO"), ["Festival em SÃO PAULO"]
        )
        self.assertEqual(self.titulos(q="exposicao"), ["EXPOSIÇÃO de arte"])

    def test_q_sem_caixa_na_descricao_e_no_local(self):
        local = Local.objects.create(nome="TEATRO ÁGUA", estado="SP")
        criar_evento(titulo="A", descricao="SHOW DE SAMBÃO")
        criar_evento(titulo="B", local=local)
        self.assertEqual(self.titulos(q="sambao"), ["A"])
        self.assertEqual(self.titulos(q="agua"), ["B"])

    def test_q_com_curinga_do_like_e_literal(self):
        criar_evento(titulo="100% bom")
        criar_evento(titulo="Outro")
        self.assertEqual(self.titulos(q="%"), ["100% bom"])

    def test_q_em_branco_sem_filtro(self):
        criar_evento(titulo="A")
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(q="  "), ["A", "B"])

    def test_categorias_ou(self):
        criar_evento(titulo="Musica", categorias=["music"])
        criar_evento(titulo="Arte", categorias=["art"])
        criar_evento(titulo="Teatro", categorias=["theater"])
        self.assertEqual(
            self.titulos(categorias="music,art"), ["Arte", "Musica"]
        )

    def test_categorias_sem_duplicar(self):
        criar_evento(categorias=["music", "festival"])
        corpo = self.buscar(categorias="music,festival").json()
        self.assertEqual(corpo["count"], 1)
        self.assertEqual(len(corpo["results"]), 1)

    def test_categoria_inexistente_400(self):
        resposta = self.buscar(categorias="music,xyz")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("categorias", resposta.json())

    def test_preco_gratuito(self):
        criar_evento(titulo="Free", gratuito=True)
        criar_evento(titulo="Pago", gratuito=False)
        self.assertEqual(self.titulos(preco="gratuito"), ["Free"])

    def test_preco_pago_inclui_ticketmaster_sem_preco(self):
        criar_evento(titulo="Free", gratuito=True)
        criar_evento(
            titulo="TM",
            provedor=Provedor.TICKETMASTER,
            id_externo="tm-1",
            gratuito=False,
        )
        self.assertEqual(self.titulos(preco="pago"), ["TM"])

    def test_preco_invalido_400(self):
        resposta = self.buscar(preco="caro")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("preco", resposta.json())

    def test_preco_vazio_sem_filtro(self):
        criar_evento(titulo="A", gratuito=True)
        criar_evento(titulo="B")
        self.assertEqual(self.titulos(preco=""), ["A", "B"])

    def test_filtros_combinados_com_e(self):
        criar_evento(titulo="Jazz Free", categorias=["music"], gratuito=True)
        criar_evento(titulo="Jazz Pago", categorias=["music"])
        criar_evento(titulo="Jazz Arte", categorias=["art"], gratuito=True)
        criar_evento(titulo="Rock Free", categorias=["music"], gratuito=True)
        self.assertEqual(
            self.titulos(q="jazz", categorias="music", preco="gratuito"),
            ["Jazz Free"],
        )


class FiltroPeriodoTest(APITestCase):
    def setUp(self):
        self.hoje = timezone.localdate()

    def dia(self, n):
        return self.hoje + timedelta(days=n)

    def titulos(self, **params):
        resposta = self.client.get("/api/eventos/", params)
        self.assertEqual(resposta.status_code, 200)
        return sorted(e["titulo"] for e in resposta.json()["results"])

    def criar_tres(self):
        criar_evento(titulo="A", data_inicio=self.dia(2))
        criar_evento(titulo="B", data_inicio=self.dia(10))
        criar_evento(titulo="C", data_inicio=self.dia(20))

    def test_dentro_do_intervalo(self):
        self.criar_tres()
        self.assertEqual(
            self.titulos(
                de=self.dia(5).isoformat(), ate=self.dia(15).isoformat()
            ),
            ["B"],
        )

    def test_so_de(self):
        self.criar_tres()
        self.assertEqual(self.titulos(de=self.dia(5).isoformat()), ["B", "C"])

    def test_so_ate(self):
        self.criar_tres()
        self.assertEqual(
            self.titulos(ate=self.dia(10).isoformat()), ["A", "B"]
        )

    def test_evento_de_varios_dias_que_cruza_o_intervalo(self):
        criar_evento(
            titulo="Festival",
            data_inicio=self.dia(1),
            data_fim=self.dia(8),
        )
        criar_evento(titulo="Fora", data_inicio=self.dia(2))
        self.assertEqual(
            self.titulos(
                de=self.dia(6).isoformat(), ate=self.dia(9).isoformat()
            ),
            ["Festival"],
        )

    def test_de_e_ate_vazios_sem_filtro(self):
        resposta = self.client.get("/api/eventos/", {"de": "", "ate": ""})
        self.assertEqual(resposta.status_code, 200)

    def test_data_invalida_400(self):
        resposta = self.client.get("/api/eventos/", {"de": "2026-13-01"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("de", resposta.json())

    def test_de_depois_de_ate_400(self):
        resposta = self.client.get(
            "/api/eventos/",
            {"de": self.dia(5).isoformat(), "ate": self.dia(2).isoformat()},
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("ate", resposta.json())

    def test_data_em_formato_basico_400(self):
        resposta = self.client.get("/api/eventos/", {"de": "20261001"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("de", resposta.json())

    def test_data_em_formato_semana_400(self):
        resposta = self.client.get("/api/eventos/", {"ate": "2026-W01-1"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("ate", resposta.json())


class FiltroDistanciaTest(APITestCase):
    # Av. Paulista (-23.561414, -46.655881); MASP a ~0.2 km;
    # Ibirapuera a ~2.5 km; Rio a ~360 km.
    PAULISTA: ClassVar = {"lat": "-23.561414", "lng": "-46.655881"}

    def evento_em(self, titulo, latitude, longitude):
        local = Local.objects.create(
            nome=titulo,
            cidade="Cidade",
            estado="XX",
            latitude=Decimal(latitude) if latitude else None,
            longitude=Decimal(longitude) if longitude else None,
        )
        return criar_evento(titulo=titulo, local=local)

    def criar_locais(self):
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        self.evento_em("MASP", "-23.561684", "-46.655981")
        self.evento_em("Ibirapuera", "-23.587416", "-46.657634")
        self.evento_em("Rio", "-22.9068", "-43.1729")

    def buscar(self, **params):
        return self.client.get("/api/eventos/", params)

    def test_dentro_do_raio(self):
        self.criar_locais()
        resposta = self.buscar(raio="5", **self.PAULISTA)
        self.assertEqual(resposta.status_code, 200)
        titulos = sorted(e["titulo"] for e in resposta.json()["results"])
        self.assertEqual(titulos, ["Ibirapuera", "MASP", "Paulista"])

    def test_distancia_km_na_resposta(self):
        self.criar_locais()
        resultados = self.buscar(raio="5", **self.PAULISTA).json()["results"]
        ibira = next(e for e in resultados if e["titulo"] == "Ibirapuera")
        self.assertAlmostEqual(ibira["distancia_km"], 2.5, delta=0.5)

    def test_ponto_coincidente(self):
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        resultados = self.buscar(raio="1", **self.PAULISTA).json()["results"]
        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]["distancia_km"], 0.0)

    def test_sem_coordenada_fica_de_fora(self):
        self.evento_em("Sem coordenada", None, None)
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        resultados = self.buscar(raio="5", **self.PAULISTA).json()["results"]
        self.assertEqual([e["titulo"] for e in resultados], ["Paulista"])

    def test_faltando_parametro_400(self):
        resposta = self.buscar(**self.PAULISTA)
        self.assertEqual(resposta.status_code, 400)
        corpo = resposta.json()
        self.assertIn("non_field_errors", corpo)
        self.assertIn("raio", corpo["non_field_errors"][0])

    def test_trio_vazio_sem_filtro(self):
        self.criar_locais()
        resposta = self.buscar(lat="", lng="", raio="")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(resposta.json()["results"]), 4)

    def test_parcialmente_vazio_400(self):
        resposta = self.buscar(lat="-23.5", lng="", raio="")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("non_field_errors", resposta.json())

    def test_valores_invalidos_400(self):
        casos = [
            ("lat", "abc"),
            ("lat", "95"),
            ("lng", "181"),
            ("raio", "-1"),
            ("raio", "0"),
        ]
        for parametro, valor in casos:
            with self.subTest(parametro=parametro, valor=valor):
                params = {**self.PAULISTA, "raio": "5", parametro: valor}
                resposta = self.buscar(**params)
                self.assertEqual(resposta.status_code, 400)
                self.assertIn(parametro, resposta.json())

    def test_sem_filtro_distancia_km_null(self):
        self.evento_em("Paulista", "-23.561414", "-46.655881")
        resultados = self.buscar().json()["results"]
        self.assertIsNone(resultados[0]["distancia_km"])
