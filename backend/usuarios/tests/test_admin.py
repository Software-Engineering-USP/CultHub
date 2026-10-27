from django.test import TestCase

from usuarios.models import Usuario


class UsuarioAdminTest(TestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_superuser(
            "adm@exemplo.com", "senha1234", nome="Adm"
        )
        self.client.force_login(self.admin)

    def test_paginas_do_admin_abrem(self):
        for url in [
            "/admin/usuarios/usuario/",
            "/admin/usuarios/usuario/add/",
            f"/admin/usuarios/usuario/{self.admin.pk}/change/",
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_admin_cria_usuario(self):
        resposta = self.client.post(
            "/admin/usuarios/usuario/add/",
            {
                "email": "Novo@Exemplo.com",
                "nome": "Novo Usuário",
                "password1": "senha-forte-123",
                "password2": "senha-forte-123",
            },
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertTrue(
            Usuario.objects.filter(email="novo@exemplo.com").exists()
        )

    def test_admin_email_duplicado_outra_caixa_da_erro_de_form(self):
        dados = {
            "email": "ADM@exemplo.com",
            "nome": "Outro",
            "password1": "senha-forte-123",
            "password2": "senha-forte-123",
        }
        resposta = self.client.post("/admin/usuarios/usuario/add/", dados)
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.context["adminform"].form.errors["email"])
        self.assertEqual(Usuario.objects.count(), 1)
