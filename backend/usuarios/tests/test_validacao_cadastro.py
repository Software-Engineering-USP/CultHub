from unittest.mock import patch

from rest_framework.test import APIClient, APITestCase

from usuarios.models import Usuario

CADASTRO = {
    "nome": "Lívia Costa",
    "email": "livia@exemplo.com",
    "senha": "senha1234",
    "aceite_termos": True,
}

EMAIL_DUPLICADO = "Já existe uma conta com este e-mail."


class CadastroValidacaoTest(APITestCase):
    url = "/api/auth/cadastro/"

    def cadastrar(self, **mudancas):
        return self.client.post(
            self.url, {**CADASTRO, **mudancas}, format="json"
        )

    def test_senha_preserva_espacos_nas_pontas(self):
        resposta = self.cadastrar(senha="  senha1234  ")
        self.assertEqual(resposta.status_code, 201)
        usuario = Usuario.objects.get(email="livia@exemplo.com")
        self.assertTrue(usuario.check_password("  senha1234  "))
        self.assertFalse(usuario.check_password("senha1234"))

    def test_email_acima_de_254_caracteres_e_rejeitado(self):
        # Válido para o EmailValidator do Django (rótulos de 63 caracteres),
        # mas maior que a coluna varchar(254) do EmailField/Postgres.
        dominio = ".".join(["a" * 63, "b" * 63, "c" * 63, "d" * 62])
        email = "a@" + dominio
        self.assertEqual(len(email), 256)
        resposta = self.cadastrar(email=email)
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("email", resposta.json())
        self.assertEqual(Usuario.objects.count(), 0)

    def test_cadastro_concorrente_mesmo_email(self):
        self.assertEqual(self.cadastrar().status_code, 201)
        self.client.post("/api/auth/sair/")

        duplicado = self.cadastrar(email="LIVIA@exemplo.com")
        self.assertEqual(duplicado.status_code, 400)
        self.assertEqual(duplicado.json()["email"], [EMAIL_DUPLICADO])

        # Duas requisições passam pela checagem "já existe?" ao mesmo tempo;
        # a segunda só descobre o conflito no INSERT.
        with patch("usuarios.serializers.Usuario.objects.filter") as filtro:
            filtro.return_value.exists.return_value = False
            resposta = self.cadastrar(email="livia@exemplo.com")

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json()["email"], [EMAIL_DUPLICADO])
        self.assertEqual(Usuario.objects.count(), 1)


class EntrarValidacaoTest(APITestCase):
    url = "/api/auth/entrar/"

    def test_entrar_senha_com_espaco_no_fim(self):
        senha = "senha-com-espaco "
        Usuario.objects.create_user("espaco@exemplo.com", senha, nome="Espaço")
        cliente = APIClient()
        resposta = cliente.post(
            self.url,
            {"email": "espaco@exemplo.com", "senha": senha},
            format="json",
        )
        self.assertEqual(resposta.status_code, 200)
