from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from agenda.models import InteresseEmEvento, PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from notificacoes.models import Notificacao
from usuarios.models import Usuario


class NotificacoesApiTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "ana@exemplo.com", "senha-forte-123", nome="Ana"
        )
        self.client.force_login(self.usuario)
        self.agora = timezone.now()
        self.url_lista = reverse("eu-notificacoes")

    def criar_evento_em(self, horas, titulo="Evento"):
        inicio = timezone.localtime(self.agora + timedelta(hours=horas))
        return criar_evento(
            titulo=titulo,
            data_inicio=inicio.date(),
            hora_inicio=inicio.time().replace(tzinfo=None),
        )

    @patch("notificacoes.views.timezone.now")
    def test_lista_cria_lembretes_para_salvos_e_presencas_proximos(
        self, agora
    ):
        agora.return_value = self.agora
        salvo = self.criar_evento_em(2, "Evento salvo")
        confirmado = self.criar_evento_em(3, "Evento confirmado")
        salvo_e_confirmado = self.criar_evento_em(
            4, "Evento salvo e confirmado"
        )
        sem_horario = criar_evento(
            titulo="Evento sem horário",
            data_inicio=timezone.localtime(self.agora).date(),
        )
        InteresseEmEvento.objects.create(usuario=self.usuario, evento=salvo)
        PresencaEmEvento.objects.create(
            usuario=self.usuario, evento=confirmado
        )
        InteresseEmEvento.objects.create(
            usuario=self.usuario, evento=salvo_e_confirmado
        )
        PresencaEmEvento.objects.create(
            usuario=self.usuario, evento=salvo_e_confirmado
        )
        InteresseEmEvento.objects.create(
            usuario=self.usuario, evento=sem_horario
        )

        resposta = self.client.get(self.url_lista)

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["nao_lidas"], 4)
        self.assertEqual(
            {item["titulo_evento"] for item in resposta.json()["resultados"]},
            {
                "Evento salvo",
                "Evento confirmado",
                "Evento salvo e confirmado",
                "Evento sem horário",
            },
        )
        notificacoes_criadas = Notificacao.objects.filter(
            usuario=self.usuario
        ).count()
        self.assertEqual(notificacoes_criadas, 4)

    @patch("notificacoes.views.timezone.now")
    def test_lista_ignora_eventos_fora_da_janela_passados_ou_removidos(
        self, agora
    ):
        agora.return_value = self.agora
        elegivel = self.criar_evento_em(1, "Elegível")
        distante = self.criar_evento_em(25, "Distante")
        passado = self.criar_evento_em(-1, "Passado")
        removido = self.criar_evento_em(2, "Removido")
        removido.removido_em = self.agora
        removido.save(update_fields=["removido_em"])
        for evento in (elegivel, distante, passado, removido):
            InteresseEmEvento.objects.create(
                usuario=self.usuario, evento=evento
            )

        resposta = self.client.get(self.url_lista)

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            [item["titulo_evento"] for item in resposta.json()["resultados"]],
            ["Elegível"],
        )

    @patch("notificacoes.views.timezone.now")
    def test_lembrete_e_unico_e_preserva_estado_de_leitura(self, agora):
        agora.return_value = self.agora
        evento = self.criar_evento_em(2)
        InteresseEmEvento.objects.create(usuario=self.usuario, evento=evento)

        primeira_resposta = self.client.get(self.url_lista)
        notificacao_id = primeira_resposta.json()["resultados"][0]["id"]
        url_ler = reverse("notificacao-ler", args=[notificacao_id])
        resposta_leitura = self.client.patch(url_ler)
        segunda_resposta = self.client.get(self.url_lista)

        self.assertEqual(resposta_leitura.status_code, 204)
        self.assertEqual(segunda_resposta.json()["nao_lidas"], 0)
        self.assertEqual(len(segunda_resposta.json()["resultados"]), 1)
        lida_em = segunda_resposta.json()["resultados"][0]["lida_em"]
        self.assertIsNotNone(lida_em)

    @patch("notificacoes.views.timezone.now")
    def test_lista_oculta_lembretes_sem_marcacao_ou_evento_ativo(self, agora):
        agora.return_value = self.agora
        ativo = self.criar_evento_em(2, "Ativo")
        sem_marcacao = self.criar_evento_em(3, "Sem marcação")
        removido = self.criar_evento_em(4, "Removido")
        passado = self.criar_evento_em(-1, "Passado")
        InteresseEmEvento.objects.create(usuario=self.usuario, evento=ativo)
        InteresseEmEvento.objects.create(
            usuario=self.usuario, evento=sem_marcacao
        )
        InteresseEmEvento.objects.create(usuario=self.usuario, evento=removido)
        PresencaEmEvento.objects.create(usuario=self.usuario, evento=passado)
        InteresseEmEvento.objects.filter(evento=sem_marcacao).delete()
        removido.removido_em = self.agora
        removido.save(update_fields=["removido_em"])
        for evento in (ativo, sem_marcacao, removido, passado):
            Notificacao.objects.create(usuario=self.usuario, evento=evento)

        resposta = self.client.get(self.url_lista)

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["nao_lidas"], 1)
        self.assertEqual(
            [item["titulo_evento"] for item in resposta.json()["resultados"]],
            ["Ativo"],
        )

    def test_marcar_todas_como_lidas(self):
        eventos = [
            criar_evento(titulo=f"Evento {numero}") for numero in range(3)
        ]
        notificacoes = [
            Notificacao.objects.create(
                usuario=self.usuario, evento=eventos[0]
            ),
            Notificacao.objects.create(
                usuario=self.usuario, evento=eventos[1]
            ),
        ]
        Notificacao.objects.create(
            usuario=self.usuario,
            evento=eventos[2],
            lida_em=timezone.now(),
        )

        resposta = self.client.post(reverse("eu-notificacoes-ler-todas"))

        self.assertEqual(resposta.status_code, 204)
        for notificacao in notificacoes:
            notificacao.refresh_from_db()
            self.assertIsNotNone(notificacao.lida_em)

    def test_nao_pode_marcar_notificacao_de_outro_usuario(self):
        outro_usuario = Usuario.objects.create_user(
            "bia@exemplo.com", "senha-forte-123", nome="Bia"
        )
        evento = criar_evento()
        notificacao = Notificacao.objects.create(
            usuario=outro_usuario,
            evento=evento,
        )

        resposta = self.client.patch(
            reverse("notificacao-ler", args=[notificacao.pk])
        )

        self.assertEqual(resposta.status_code, 404)
        notificacao.refresh_from_db()
        self.assertIsNone(notificacao.lida_em)

    def test_usuario_sem_login_nao_consulta_notificacoes(self):
        self.client.logout()

        resposta = self.client.get(self.url_lista)

        self.assertEqual(resposta.status_code, 403)
