import uuid
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from agenda.models import PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from usuarios.models import Usuario

SENHA = "senha-forte-123"


class PresentesTest(APITestCase):
    def setUp(self):
        self.ana = Usuario.objects.create_user(
            "ana@exemplo.com",
            SENHA,
            nome="Ana Souza",
            cidade="São Paulo",
            bairro="Pinheiros",
        )
        self.client.force_login(self.ana)
        self.evento = criar_evento()
        self.agora = timezone.now()

    def url(self, pk=None):
        return reverse("evento-presencas", args=[pk or self.evento.pk])

    def pessoa(self, nome, minutos=0, evento=None):
        usuario = Usuario.objects.create_user(
            f"{uuid.uuid4().hex}@exemplo.com", SENHA, nome=nome
        )
        presenca = PresencaEmEvento.objects.create(
            usuario=usuario, evento=evento or self.evento
        )
        PresencaEmEvento.objects.filter(pk=presenca.pk).update(
            marcado_em=self.agora + timedelta(minutes=minutos)
        )
        return usuario

    def nomes(self, **params):
        resposta = self.client.get(self.url(), params)
        self.assertEqual(resposta.status_code, 200, resposta.content)
        return [p["nome"] for p in resposta.json()["results"]]

    def test_sem_login_responde_403(self):
        self.pessoa("Bia")
        self.client.logout()
        self.assertEqual(self.client.get(self.url()).status_code, 403)

    def test_evento_inexistente_responde_404(self):
        resposta = self.client.get(self.url(uuid.uuid4()))
        self.assertEqual(resposta.status_code, 404)

    def test_evento_sem_presencas_responde_lista_vazia(self):
        resposta = self.client.get(self.url())
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["count"], 0)
        self.assertEqual(resposta.json()["results"], [])

    def test_mostra_so_id_nome_e_iniciais(self):
        PresencaEmEvento.objects.create(usuario=self.ana, evento=self.evento)
        pessoa = self.client.get(self.url()).json()["results"][0]
        self.assertEqual(
            pessoa,
            {"id": str(self.ana.pk), "nome": "Ana Souza", "iniciais": "AS"},
        )

    def test_da_confirmacao_mais_recente_para_a_mais_antiga(self):
        self.pessoa("Antiga", minutos=0)
        self.pessoa("Nova", minutos=10)
        self.pessoa("Meio", minutos=5)
        self.assertEqual(self.nomes(), ["Nova", "Meio", "Antiga"])

    def test_so_lista_presencas_do_evento(self):
        self.pessoa("Bia")
        self.pessoa("Caio", evento=criar_evento(titulo="Outro"))
        self.assertEqual(self.nomes(), ["Bia"])

    def test_pagina_como_as_outras_listas(self):
        for minuto in range(3):
            self.pessoa(f"P{minuto}", minutos=minuto)
        resposta = self.client.get(self.url(), {"tamanho": 2})
        corpo = resposta.json()
        self.assertEqual(corpo["count"], 3)
        self.assertIsNotNone(corpo["next"])
        self.assertEqual([p["nome"] for p in corpo["results"]], ["P2", "P1"])
        self.assertEqual(self.nomes(tamanho=2, page=2), ["P0"])

    def test_evento_removido_continua_listando(self):
        self.pessoa("Bia")
        self.evento.removido_em = timezone.now()
        self.evento.save()
        self.assertEqual(self.nomes(), ["Bia"])

    def test_usuario_excluido_some_da_lista(self):
        bia = self.pessoa("Bia")
        self.pessoa("Caio", minutos=1)
        bia.delete()
        self.assertEqual(self.nomes(), ["Caio"])

    def test_conta_desativada_fica_de_fora(self):
        bia = self.pessoa("Bia")
        self.pessoa("Caio", minutos=1)
        bia.is_active = False
        bia.save()
        self.assertEqual(self.nomes(), ["Caio"])

    def test_consultas_nao_crescem_com_o_numero_de_pessoas(self):
        for minuto in range(5):
            self.pessoa(f"P{minuto}", minutos=minuto)
        # sessão, usuário, evento, contagem e a página com os usuários.
        with self.assertNumQueries(5):
            resposta = self.client.get(self.url())
        self.assertEqual(len(resposta.json()["results"]), 5)
