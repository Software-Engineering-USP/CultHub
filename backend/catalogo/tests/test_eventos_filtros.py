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

    def test_filtros_combinados_com_e(self):
        criar_evento(titulo="Jazz Free", categorias=["music"], gratuito=True)
        criar_evento(titulo="Jazz Pago", categorias=["music"])
        criar_evento(titulo="Jazz Arte", categorias=["art"], gratuito=True)
        criar_evento(titulo="Rock Free", categorias=["music"], gratuito=True)
        self.assertEqual(
            self.titulos(q="jazz", categorias="music", preco="gratuito"),
            ["Jazz Free"],
        )
