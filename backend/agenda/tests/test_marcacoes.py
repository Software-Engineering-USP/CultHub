import uuid
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from agenda.models import InteresseEmEvento, PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from usuarios.models import Usuario


class MarcacaoBase:
    rota = None
    modelo = None
    chave = None

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "ana@exemplo.com", "senha-forte-123", nome="Ana"
        )
        self.client.force_login(self.usuario)
        self.evento = criar_evento()

    def url(self, pk=None):
        return reverse(self.rota, args=[pk or self.evento.pk])

    def test_post_cria_e_responde_201(self):
        resposta = self.client.post(self.url())
        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(resposta.json(), {self.chave: True})
        self.assertEqual(self.modelo.objects.count(), 1)

    def test_post_repetido_responde_200_sem_duplicar(self):
        self.client.post(self.url())
        resposta = self.client.post(self.url())
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {self.chave: True})
        self.assertEqual(self.modelo.objects.count(), 1)

    def test_delete_apaga_e_responde_204(self):
        self.modelo.objects.create(usuario=self.usuario, evento=self.evento)
        resposta = self.client.delete(self.url())
        self.assertEqual(resposta.status_code, 204)
        self.assertEqual(self.modelo.objects.count(), 0)

    def test_delete_sem_marcacao_responde_204(self):
        resposta = self.client.delete(self.url())
        self.assertEqual(resposta.status_code, 204)

    def test_sem_login_responde_403(self):
        self.client.logout()
        self.assertEqual(self.client.post(self.url()).status_code, 403)
        self.assertEqual(self.client.delete(self.url()).status_code, 403)

    def test_evento_inexistente_responde_404(self):
        url = self.url(uuid.uuid4())
        self.assertEqual(self.client.post(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)

    def test_evento_removido_recusa_post_com_409(self):
        self.evento.removido_em = timezone.now()
        self.evento.save()
        resposta = self.client.post(self.url())
        self.assertEqual(resposta.status_code, 409)
        self.assertEqual(
            resposta.json(),
            {"detail": "Este evento foi removido do catálogo."},
        )
        self.assertEqual(self.modelo.objects.count(), 0)

    def test_evento_removido_com_marcacao_existente_post_e_idempotente(self):
        self.modelo.objects.create(usuario=self.usuario, evento=self.evento)
        self.evento.removido_em = timezone.now()
        self.evento.save()
        resposta = self.client.post(self.url())
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(self.modelo.objects.count(), 1)

    def test_evento_removido_aceita_delete(self):
        self.modelo.objects.create(usuario=self.usuario, evento=self.evento)
        self.evento.removido_em = timezone.now()
        self.evento.save()
        resposta = self.client.delete(self.url())
        self.assertEqual(resposta.status_code, 204)
        self.assertEqual(self.modelo.objects.count(), 0)

    def test_evento_passado_aceita_post(self):
        evento = criar_evento(
            data_inicio=timezone.localdate() - timedelta(days=1)
        )
        resposta = self.client.post(self.url(evento.pk))
        self.assertEqual(resposta.status_code, 201)

    def test_delete_nao_apaga_marcacao_de_outro_usuario(self):
        outro = Usuario.objects.create_user(
            "bia@exemplo.com", "senha-forte-123", nome="Bia"
        )
        self.modelo.objects.create(usuario=outro, evento=self.evento)
        resposta = self.client.delete(self.url())
        self.assertEqual(resposta.status_code, 204)
        self.assertEqual(self.modelo.objects.count(), 1)

    def test_post_sem_csrf_recusado(self):
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(self.usuario)
        resposta = cliente.post(self.url())
        self.assertEqual(resposta.status_code, 403)
        self.assertEqual(self.modelo.objects.count(), 0)


class SalvarEventoTests(MarcacaoBase, APITestCase):
    rota = "evento-salvar"
    modelo = InteresseEmEvento
    chave = "salvo"

    def test_salvar_nao_marca_presenca(self):
        self.client.post(self.url())
        self.assertEqual(PresencaEmEvento.objects.count(), 0)


class PresencaEventoTests(MarcacaoBase, APITestCase):
    rota = "evento-presenca"
    modelo = PresencaEmEvento
    chave = "presenca"

    def test_presenca_nao_salva_evento(self):
        self.client.post(self.url())
        self.assertEqual(InteresseEmEvento.objects.count(), 0)
