import os
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from usuarios.models import Usuario


class UsuarioManagerTest(TestCase):
    def test_create_user_normaliza_email_e_cria_hash(self):
        usuario = Usuario.objects.create_user(
            " Livia@Exemplo.COM ", "senha1234", nome="Lívia Costa"
        )
        self.assertEqual(usuario.email, "livia@exemplo.com")
        self.assertTrue(usuario.check_password("senha1234"))
        self.assertFalse(usuario.is_staff)
        self.assertTrue(usuario.is_active)

    def test_create_superuser(self):
        usuario = Usuario.objects.create_superuser(
            "adm@exemplo.com", "senha1234", nome="Adm"
        )
        self.assertTrue(usuario.is_staff)
        self.assertTrue(usuario.is_superuser)

    def test_email_obrigatorio(self):
        with self.assertRaises(ValueError):
            Usuario.objects.create_user("", "senha1234", nome="X")


class IniciaisTest(TestCase):
    def test_iniciais(self):
        casos = {
            "Lívia Costa": "LC",
            "  maria da silva ": "MS",
            "Ana": "A",
            "": "",
        }
        for nome, esperado in casos.items():
            with self.subTest(nome=nome):
                self.assertEqual(Usuario(nome=nome).iniciais, esperado)


class ComandosTest(TestCase):
    def test_createsuperuser_pela_linha_de_comando(self):
        with mock.patch.dict(
            os.environ, {"DJANGO_SUPERUSER_PASSWORD": "senha1234"}
        ):
            call_command(
                "createsuperuser",
                "--noinput",
                "--email",
                "Adm@Exemplo.com",
                "--nome",
                "Adm",
                stdout=StringIO(),
            )
        usuario = Usuario.objects.get(email="adm@exemplo.com")
        self.assertTrue(usuario.is_superuser)
        self.assertTrue(usuario.check_password("senha1234"))

    def test_sem_migracoes_pendentes(self):
        try:
            call_command(
                "makemigrations", "--check", "--dry-run", stdout=StringIO()
            )
        except SystemExit:
            self.fail("Há mudanças de modelo sem migração.")
