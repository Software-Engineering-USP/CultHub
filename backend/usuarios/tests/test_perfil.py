from rest_framework.test import APITestCase

from usuarios.models import Usuario


class PerfilTest(APITestCase):
    url = "/api/eu/"

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "livia@exemplo.com", "senha1234", nome="Lívia Costa"
        )
        self.client.force_login(self.usuario)

    def patch(self, dados):
        return self.client.patch(self.url, dados, format="json")

    def test_get_perfil(self):
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            set(resposta.json()),
            {
                "id",
                "nome",
                "email",
                "cidade",
                "bairro",
                "preferencias",
                "iniciais",
            },
        )
        self.assertEqual(resposta.json()["id"], str(self.usuario.pk))

    def test_get_sem_login(self):
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_patch_dados_pessoais(self):
        resposta = self.patch(
            {
                "nome": "Lívia C. Souza",
                "cidade": "São Paulo, SP",
                "bairro": "Vila Mariana",
            }
        )
        self.assertEqual(resposta.status_code, 200)
        dados = resposta.json()
        self.assertEqual(dados["nome"], "Lívia C. Souza")
        self.assertEqual(dados["cidade"], "São Paulo, SP")
        self.assertEqual(dados["bairro"], "Vila Mariana")
        self.assertEqual(dados["iniciais"], "LS")
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.bairro, "Vila Mariana")

    def test_patch_preferencias_substitui(self):
        self.assertEqual(
            self.patch({"preferencias": ["music", "art"]}).status_code, 200
        )
        resposta = self.patch({"preferencias": ["theater"]})
        self.assertEqual(resposta.json()["preferencias"], ["theater"])

    def test_patch_preferencias_vazia(self):
        self.patch({"preferencias": ["music"]})
        resposta = self.patch({"preferencias": []})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["preferencias"], [])

    def test_patch_preferencia_inexistente(self):
        self.patch({"preferencias": ["music"]})
        resposta = self.patch({"preferencias": ["jazz"]})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("preferencias", resposta.json())
        self.assertEqual(
            self.client.get(self.url).json()["preferencias"], ["music"]
        )

    def test_patch_email_ignorado(self):
        resposta = self.patch({"email": "outro@exemplo.com"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["email"], "livia@exemplo.com")

    def test_patch_nome_em_branco(self):
        resposta = self.patch({"nome": "  "})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("nome", resposta.json())

    def test_put_nao_permitido(self):
        resposta = self.client.put(self.url, {"nome": "X"}, format="json")
        self.assertEqual(resposta.status_code, 405)
