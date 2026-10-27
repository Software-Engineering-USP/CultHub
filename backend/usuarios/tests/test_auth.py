from rest_framework.test import APIClient, APITestCase

from usuarios.models import Usuario

CADASTRO = {
    "nome": "Lívia Costa",
    "email": "livia@exemplo.com",
    "senha": "senha1234",
    "aceite_termos": True,
}


class CadastroTest(APITestCase):
    url = "/api/auth/cadastro/"

    def cadastrar(self, **mudancas):
        return self.client.post(
            self.url, {**CADASTRO, **mudancas}, format="json"
        )

    def test_cadastro_cria_loga_e_devolve_perfil(self):
        resposta = self.cadastrar()
        self.assertEqual(resposta.status_code, 201)
        dados = resposta.json()
        self.assertEqual(dados["email"], "livia@exemplo.com")
        self.assertEqual(dados["nome"], "Lívia Costa")
        self.assertEqual(dados["iniciais"], "LC")
        self.assertEqual(dados["cidade"], "")
        self.assertEqual(dados["bairro"], "")
        self.assertEqual(dados["preferencias"], [])
        self.assertNotIn("senha", dados)
        usuario = Usuario.objects.get(email="livia@exemplo.com")
        self.assertIsNotNone(usuario.termos_aceitos_em)
        self.assertEqual(self.client.session["_auth_user_id"], str(usuario.pk))

    def test_cadastro_normaliza_email(self):
        resposta = self.cadastrar(email=" Livia@Exemplo.COM ")
        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(resposta.json()["email"], "livia@exemplo.com")

    def test_cadastro_email_duplicado_outra_caixa(self):
        self.assertEqual(self.cadastrar().status_code, 201)
        self.client.post("/api/auth/sair/")
        resposta = self.cadastrar(email="LIVIA@exemplo.com")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("email", resposta.json())
        self.assertEqual(Usuario.objects.count(), 1)

    def test_cadastro_sem_aceite(self):
        sem_aceite = {
            k: v for k, v in CADASTRO.items() if k != "aceite_termos"
        }
        casos = {
            "falso": {**CADASTRO, "aceite_termos": False},
            "ausente": sem_aceite,
        }
        for nome, corpo in casos.items():
            with self.subTest(caso=nome):
                resposta = self.client.post(self.url, corpo, format="json")
                self.assertEqual(resposta.status_code, 400)
                self.assertIn("aceite_termos", resposta.json())
        self.assertEqual(Usuario.objects.count(), 0)

    def test_cadastro_senha_curta(self):
        resposta = self.cadastrar(senha="1234567")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("senha", resposta.json())

    def test_cadastro_senha_so_numeros_aceita(self):
        self.assertEqual(self.cadastrar(senha="12345678").status_code, 201)

    def test_cadastro_nome_em_branco(self):
        resposta = self.cadastrar(nome="   ")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("nome", resposta.json())


class EntrarSairTest(APITestCase):
    url = "/api/auth/entrar/"

    def setUp(self):
        Usuario.objects.create_user(
            "livia@exemplo.com", "senha1234", nome="Lívia Costa"
        )

    def entrar(self, **corpo):
        dados = {"email": "livia@exemplo.com", "senha": "senha1234"}
        return self.client.post(self.url, {**dados, **corpo}, format="json")

    def test_entrar_ok_com_lembrar_false(self):
        resposta = self.entrar()
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["email"], "livia@exemplo.com")
        self.assertIn("_auth_user_id", self.client.session)
        self.assertTrue(self.client.session.get_expire_at_browser_close())

    def test_entrar_lembrar_true(self):
        self.assertEqual(self.entrar(lembrar=True).status_code, 200)
        self.assertFalse(self.client.session.get_expire_at_browser_close())

    def test_entrar_email_outra_caixa(self):
        resposta = self.entrar(email=" LIVIA@exemplo.com")
        self.assertEqual(resposta.status_code, 200)

    def test_entrar_senha_errada_e_email_inexistente(self):
        errada = self.entrar(senha="errada123")
        inexistente = self.entrar(email="nao@existe.com")
        self.assertEqual(errada.status_code, 400)
        self.assertEqual(inexistente.status_code, 400)
        self.assertEqual(
            errada.json()["non_field_errors"],
            inexistente.json()["non_field_errors"],
        )
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_sair(self):
        self.entrar()
        resposta = self.client.post("/api/auth/sair/")
        self.assertEqual(resposta.status_code, 204)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_sair_sem_login(self):
        self.assertEqual(self.client.post("/api/auth/sair/").status_code, 403)


class CsrfTest(APITestCase):
    def test_csrf_seta_cookie(self):
        resposta = self.client.get("/api/auth/csrf/")
        self.assertEqual(resposta.status_code, 204)
        self.assertIn("csrftoken", resposta.cookies)

    def test_post_anonimo_sem_csrf_recusado(self):
        cliente = APIClient(enforce_csrf_checks=True)
        Usuario.objects.create_user(
            "ja@exemplo.com", "senha1234", nome="Já Existe"
        )
        cadastro = cliente.post("/api/auth/cadastro/", CADASTRO, format="json")
        entrar = cliente.post(
            "/api/auth/entrar/",
            {"email": "ja@exemplo.com", "senha": "senha1234"},
            format="json",
        )
        self.assertEqual(cadastro.status_code, 403)
        self.assertEqual(entrar.status_code, 403)
        self.assertEqual(Usuario.objects.count(), 1)

    def test_post_anonimo_com_csrf_aceito(self):
        cliente = APIClient(enforce_csrf_checks=True)
        token = cliente.get("/api/auth/csrf/").cookies["csrftoken"].value
        resposta = cliente.post(
            "/api/auth/cadastro/",
            CADASTRO,
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resposta.status_code, 201)


class LembrarDeNovoTest(APITestCase):
    def test_lembrar_true_em_segundo_login_do_mesmo_usuario(self):
        Usuario.objects.create_user(
            "livia@exemplo.com", "senha1234", nome="Lívia Costa"
        )
        dados = {"email": "livia@exemplo.com", "senha": "senha1234"}
        self.client.post("/api/auth/entrar/", dados, format="json")
        self.assertTrue(self.client.session.get_expire_at_browser_close())
        resposta = self.client.post(
            "/api/auth/entrar/", {**dados, "lembrar": True}, format="json"
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(self.client.session.get_expire_at_browser_close())
