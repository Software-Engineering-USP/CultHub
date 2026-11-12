from django.db import IntegrityError, transaction
from django.test import TestCase

from agenda.models import InteresseEmEvento, PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from usuarios.models import Usuario


class MarcacoesTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "ana@exemplo.com", "senha-forte-123", nome="Ana"
        )
        self.evento = criar_evento()

    def test_mesmo_usuario_e_evento_nao_repete(self):
        for modelo in (InteresseEmEvento, PresencaEmEvento):
            with self.subTest(modelo=modelo.__name__):
                modelo.objects.create(usuario=self.usuario, evento=self.evento)
                with (
                    self.assertRaises(IntegrityError),
                    transaction.atomic(),
                ):
                    modelo.objects.create(
                        usuario=self.usuario, evento=self.evento
                    )

    def test_salvo_e_presenca_sao_independentes(self):
        InteresseEmEvento.objects.create(
            usuario=self.usuario, evento=self.evento
        )
        PresencaEmEvento.objects.create(
            usuario=self.usuario, evento=self.evento
        )
        self.assertEqual(self.usuario.interesses.count(), 1)
        self.assertEqual(self.usuario.presencas.count(), 1)

    def test_apagar_evento_apaga_marcacoes(self):
        InteresseEmEvento.objects.create(
            usuario=self.usuario, evento=self.evento
        )
        PresencaEmEvento.objects.create(
            usuario=self.usuario, evento=self.evento
        )
        self.evento.delete()
        self.assertEqual(InteresseEmEvento.objects.count(), 0)
        self.assertEqual(PresencaEmEvento.objects.count(), 0)

    def test_marcado_em_preenchido(self):
        salvo = InteresseEmEvento.objects.create(
            usuario=self.usuario, evento=self.evento
        )
        self.assertIsNotNone(salvo.marcado_em)
