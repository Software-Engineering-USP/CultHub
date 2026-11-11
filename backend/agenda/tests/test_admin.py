from django.test import TestCase
from django.urls import reverse

from agenda.models import InteresseEmEvento, PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from usuarios.models import Usuario


class AdminAgendaTests(TestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_superuser(
            "admin@exemplo.com", "senha-forte-123", nome="Admin"
        )
        self.client.force_login(self.admin)
        evento = criar_evento()
        InteresseEmEvento.objects.create(usuario=self.admin, evento=evento)
        PresencaEmEvento.objects.create(usuario=self.admin, evento=evento)

    def test_admin_lista_salvos_e_presencas(self):
        for nome in ("interesseemevento", "presencaemevento"):
            with self.subTest(modelo=nome):
                url = reverse(f"admin:agenda_{nome}_changelist")
                resposta = self.client.get(url, {"q": "admin@exemplo.com"})
                self.assertEqual(resposta.status_code, 200)

    def test_admin_nao_permite_adicionar(self):
        for nome in ("interesseemevento", "presencaemevento"):
            with self.subTest(modelo=nome):
                resposta = self.client.get(reverse(f"admin:agenda_{nome}_add"))
                self.assertEqual(resposta.status_code, 403)
