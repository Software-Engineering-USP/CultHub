from rest_framework.test import APITestCase

from agenda.models import InteresseEmEvento, PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from usuarios.models import Usuario


class CatalogoComMarcacoesTest(APITestCase):
    def setUp(self):
        self.ana = Usuario.objects.create_user(
            "ana@exemplo.test", "senha-forte-123", nome="Ana"
        )
        self.beto = Usuario.objects.create_user(
            "beto@exemplo.test", "senha-forte-123", nome="Beto"
        )

    def detalhe(self, evento):
        return self.client.get(f"/api/eventos/{evento.id}/")

    def test_detalhe_anonimo(self):
        evento = criar_evento()
        PresencaEmEvento.objects.create(usuario=self.ana, evento=evento)
        PresencaEmEvento.objects.create(usuario=self.beto, evento=evento)
        resposta = self.detalhe(evento)
        corpo = resposta.json()
        self.assertIs(corpo["salvo"], False)
        self.assertIs(corpo["presenca"], False)
        self.assertEqual(corpo["total_presencas"], 2)
        texto = resposta.content.decode()
        for usuario in (self.ana, self.beto):
            self.assertNotIn(usuario.email, texto)
            self.assertNotIn(usuario.nome, texto)

    def test_detalhe_logado_com_marcacoes(self):
        evento = criar_evento()
        InteresseEmEvento.objects.create(usuario=self.ana, evento=evento)
        PresencaEmEvento.objects.create(usuario=self.ana, evento=evento)
        self.client.force_login(self.ana)
        corpo = self.detalhe(evento).json()
        self.assertIs(corpo["salvo"], True)
        self.assertIs(corpo["presenca"], True)
        self.assertEqual(corpo["total_presencas"], 1)

    def test_marcacao_de_outro_usuario_nao_aparece(self):
        evento = criar_evento()
        InteresseEmEvento.objects.create(usuario=self.beto, evento=evento)
        self.client.force_login(self.ana)
        self.assertIs(self.detalhe(evento).json()["salvo"], False)
        itens = self.client.get("/api/eventos/").json()["results"]
        self.assertEqual([i["salvo"] for i in itens], [False])

    def test_presenca_de_outro_usuario_nao_aparece(self):
        evento = criar_evento()
        PresencaEmEvento.objects.create(usuario=self.beto, evento=evento)
        self.client.force_login(self.ana)
        corpo = self.detalhe(evento).json()
        self.assertIs(corpo["presenca"], False)
        self.assertEqual(corpo["total_presencas"], 1)

    def test_listagem_tem_salvo_e_nao_tem_contagem(self):
        salvo = criar_evento(titulo="Salvo")
        criar_evento(titulo="Outro")
        InteresseEmEvento.objects.create(usuario=self.ana, evento=salvo)
        self.client.force_login(self.ana)
        itens = self.client.get("/api/eventos/").json()["results"]
        por_titulo = {i["titulo"]: i for i in itens}
        self.assertIs(por_titulo["Salvo"]["salvo"], True)
        self.assertIs(por_titulo["Outro"]["salvo"], False)
        for item in itens:
            self.assertNotIn("total_presencas", item)
            self.assertNotIn("presenca", item)

    def test_listagem_logada_nao_aumenta_consultas(self):
        for numero in range(3):
            evento = criar_evento(titulo=f"E{numero}")
            InteresseEmEvento.objects.create(usuario=self.ana, evento=evento)
        self.client.force_login(self.ana)
        # sessão e usuário, depois as mesmas 5 da listagem anônima: contagem,
        # eventos (com as subqueries de salvo/presença) e os prefetch de
        # categorias, imagens e preços.
        with self.assertNumQueries(7):
            self.assertEqual(self.client.get("/api/eventos/").status_code, 200)
