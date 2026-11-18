from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.db import OperationalError
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from agenda.models import InteresseEmEvento
from catalogo.models import CategoriaCultural, Evento, Local
from catalogo.tests.fabrica import criar_evento
from catalogo.tests.test_importacao import eventos_da_fixture
from notificacoes.models import Notificacao, TipoNotificacao
from notificacoes.servicos import LIMITE_POR_USUARIO, notificar_eventos_novos
from usuarios.models import Usuario


def criar_usuario(nome, preferencias=(), **campos):
    usuario = Usuario.objects.create_user(
        f"{nome.lower()}@exemplo.com", "senha-forte-123", nome=nome, **campos
    )
    usuario.preferencias.set(
        CategoriaCultural.objects.filter(codigo__in=preferencias)
    )
    return usuario


def local_em(cidade):
    return Local.objects.create(nome=f"Casa em {cidade}", cidade=cidade)


def destinatarios(evento):
    return set(
        Notificacao.objects.filter(
            evento=evento, tipo=TipoNotificacao.EVENTO_NOVO
        ).values_list("usuario__nome", flat=True)
    )


class NotificarEventosNovosTest(TestCase):
    def test_avisa_quem_tem_a_categoria_nas_preferencias(self):
        criar_usuario("Ana", ["music"])
        criar_usuario("Bia", ["music", "art"])
        criar_usuario("Caio", ["theater"])
        criar_usuario("Davi")
        evento = criar_evento(categorias=["music"])

        criadas = notificar_eventos_novos([evento.pk])

        self.assertEqual(criadas, 2)
        self.assertEqual(destinatarios(evento), {"Ana", "Bia"})

    def test_evento_com_duas_categorias_gera_uma_notificacao_por_pessoa(self):
        criar_usuario("Ana", ["music", "art"])
        evento = criar_evento(categorias=["music", "art"])

        self.assertEqual(notificar_eventos_novos([evento.pk]), 1)

    def test_cidade_do_perfil_filtra_ignorando_caixa_acento_e_estado(self):
        criar_usuario("Ana", ["music"], cidade="sao paulo, SP")
        criar_usuario("Bia", ["music"], cidade="Campinas")
        criar_usuario("Caio", ["music"])
        evento = criar_evento(
            categorias=["music"], local=local_em("São Paulo")
        )

        notificar_eventos_novos([evento.pk])

        self.assertEqual(destinatarios(evento), {"Ana", "Caio"})

    def test_cidade_do_perfil_aceita_outros_separadores(self):
        criar_usuario("Ana", ["music"], cidade="São Paulo - SP")
        criar_usuario("Bia", ["music"], cidade="são paulo/sp")
        criar_usuario("Caio", ["music"], cidade="Rio de Janeiro - RJ")
        evento = criar_evento(
            categorias=["music"], local=local_em("São Paulo")
        )

        notificar_eventos_novos([evento.pk])

        self.assertEqual(destinatarios(evento), {"Ana", "Bia"})

    def test_evento_sem_cidade_filtra_pelo_estado(self):
        criar_usuario("Ana", ["music"], cidade="São Paulo, SP")
        criar_usuario("Bia", ["music"], cidade="Rio de Janeiro, RJ")
        criar_usuario("Caio", ["music"], cidade="São Paulo")
        criar_usuario("Davi", ["music"])
        evento = criar_evento(
            categorias=["music"],
            local=Local.objects.create(nome="MorumBis", estado="SP"),
        )

        notificar_eventos_novos([evento.pk])

        self.assertEqual(destinatarios(evento), {"Ana", "Caio", "Davi"})

    def test_evento_sem_cidade_nem_estado_vai_para_todos(self):
        criar_usuario("Ana", ["music"], cidade="São Paulo, SP")
        criar_usuario("Caio", ["music"])
        sem_local = criar_evento(categorias=["music"], local=None)
        sem_regiao = criar_evento(categorias=["music"], local=local_em(""))

        notificar_eventos_novos([sem_local.pk, sem_regiao.pk])

        self.assertEqual(destinatarios(sem_local), {"Ana", "Caio"})
        self.assertEqual(destinatarios(sem_regiao), {"Ana", "Caio"})

    def test_ignora_conta_desativada(self):
        criar_usuario("Ana", ["music"], is_active=False)
        evento = criar_evento(categorias=["music"])

        self.assertEqual(notificar_eventos_novos([evento.pk]), 0)

    def test_ignora_evento_removido_passado_ou_sem_categoria(self):
        criar_usuario("Ana", ["music"])
        hoje = timezone.localdate()
        removido = criar_evento(
            categorias=["music"], removido_em=timezone.now()
        )
        passado = criar_evento(
            categorias=["music"], data_inicio=hoje - timedelta(days=2)
        )
        sem_categoria = criar_evento()

        criadas = notificar_eventos_novos(
            [removido.pk, passado.pk, sem_categoria.pk]
        )

        self.assertEqual(criadas, 0)
        self.assertFalse(Notificacao.objects.exists())

    def test_limite_por_pessoa_fica_com_os_que_acontecem_antes(self):
        ana = criar_usuario("Ana", ["music"])
        hoje = timezone.localdate()
        local = local_em("São Paulo")
        eventos = [
            criar_evento(
                titulo=f"Show {dias}",
                categorias=["music"],
                local=local,
                data_inicio=hoje + timedelta(days=dias),
            )
            for dias in range(LIMITE_POR_USUARIO + 3, 0, -1)
        ]

        criadas = notificar_eventos_novos([evento.pk for evento in eventos])

        self.assertEqual(criadas, LIMITE_POR_USUARIO)
        self.assertEqual(
            set(ana.notificacoes.values_list("evento__titulo", flat=True)),
            {f"Show {dias}" for dias in range(1, LIMITE_POR_USUARIO + 1)},
        )

    def test_repetir_nao_duplica(self):
        criar_usuario("Ana", ["music"])
        evento = criar_evento(categorias=["music"])

        self.assertEqual(notificar_eventos_novos([evento.pk]), 1)
        self.assertEqual(notificar_eventos_novos([evento.pk]), 0)
        self.assertEqual(Notificacao.objects.count(), 1)

    def test_lista_vazia(self):
        criar_usuario("Ana", ["music"])
        self.assertEqual(notificar_eventos_novos([]), 0)


class ImportacaoNotificaTest(TestCase):
    @override_settings(TICKETMASTER_API_KEY="chave")
    def test_comando_avisa_so_dos_eventos_criados(self):
        ana = criar_usuario("Ana", ["music"])
        eventos = eventos_da_fixture()
        for dados in eventos:
            dados["dates"]["start"]["localDate"] = (
                timezone.localdate() + timedelta(days=3)
            ).isoformat()
        saida = StringIO()
        caminho = (
            "catalogo.management.commands.importar_ticketmaster.buscar_todos"
        )
        with patch(caminho, return_value=eventos):
            call_command("importar_ticketmaster", stdout=saida)
            primeira = ana.notificacoes.count()
            call_command("importar_ticketmaster", stdout=StringIO())

        self.assertGreater(primeira, 0)
        self.assertLessEqual(primeira, LIMITE_POR_USUARIO)
        self.assertIn(
            f"notificações de evento novo: {primeira}", saida.getvalue()
        )
        self.assertEqual(ana.notificacoes.count(), primeira)
        self.assertFalse(
            ana.notificacoes.exclude(tipo=TipoNotificacao.EVENTO_NOVO).exists()
        )

    @override_settings(TICKETMASTER_API_KEY="chave")
    def test_falha_nos_avisos_desfaz_a_importacao(self):
        comando = "catalogo.management.commands.importar_ticketmaster"
        with (
            patch(
                f"{comando}.buscar_todos", return_value=eventos_da_fixture()
            ),
            patch(
                f"{comando}.notificar_eventos_novos",
                side_effect=OperationalError("banco fora"),
            ),
            self.assertRaises(OperationalError),
        ):
            call_command("importar_ticketmaster", stdout=StringIO())

        self.assertFalse(Evento.objects.exists())


class ListaComEventosNovosTest(APITestCase):
    def setUp(self):
        self.usuario = criar_usuario("Ana", ["music"])
        self.client.force_login(self.usuario)
        self.url = reverse("eu-notificacoes")
        self.hoje = timezone.localdate()

    def avisar(self, evento, tipo=TipoNotificacao.EVENTO_NOVO, **campos):
        notificacao = Notificacao.objects.create(
            usuario=self.usuario, evento=evento, tipo=tipo
        )
        if campos:
            Notificacao.objects.filter(pk=notificacao.pk).update(**campos)
        return notificacao

    def titulos(self):
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        return [
            item["titulo_evento"] for item in resposta.json()["resultados"]
        ]

    def test_evento_novo_aparece_sem_estar_salvo_e_com_o_tipo(self):
        evento = criar_evento(
            titulo="Show", data_inicio=self.hoje + timedelta(days=30)
        )
        self.avisar(evento)

        resposta = self.client.get(self.url).json()

        self.assertEqual(resposta["nao_lidas"], 1)
        self.assertEqual(resposta["resultados"][0]["tipo"], "evento_novo")
        self.assertEqual(resposta["resultados"][0]["titulo_evento"], "Show")

    def test_lembrete_continua_com_o_tipo_lembrete(self):
        evento = criar_evento(data_inicio=self.hoje)
        InteresseEmEvento.objects.create(usuario=self.usuario, evento=evento)

        resultados = self.client.get(self.url).json()["resultados"]

        self.assertEqual([item["tipo"] for item in resultados], ["lembrete"])

    def test_mesmo_evento_pode_ter_os_dois_tipos(self):
        evento = criar_evento(data_inicio=self.hoje)
        InteresseEmEvento.objects.create(usuario=self.usuario, evento=evento)
        self.avisar(evento)

        resposta = self.client.get(self.url).json()

        self.assertEqual(resposta["nao_lidas"], 2)
        self.assertEqual(
            {item["tipo"] for item in resposta["resultados"]},
            {"lembrete", "evento_novo"},
        )

    def test_evento_novo_some_depois_de_sete_dias(self):
        futuro = self.hoje + timedelta(days=30)
        recente = criar_evento(titulo="Recente", data_inicio=futuro)
        antigo = criar_evento(titulo="Antigo", data_inicio=futuro)
        agora = timezone.now()
        self.avisar(recente, criada_em=agora - timedelta(days=6))
        self.avisar(antigo, criada_em=agora - timedelta(days=8))

        self.assertEqual(self.titulos(), ["Recente"])

    def test_evento_novo_some_quando_o_evento_passa_ou_e_removido(self):
        self.avisar(
            criar_evento(
                titulo="Passado", data_inicio=self.hoje - timedelta(days=1)
            )
        )
        self.avisar(
            criar_evento(
                titulo="Removido",
                data_inicio=self.hoje + timedelta(days=5),
                removido_em=timezone.now(),
            )
        )
        self.avisar(
            criar_evento(
                titulo="Vigente", data_inicio=self.hoje + timedelta(days=5)
            )
        )

        self.assertEqual(self.titulos(), ["Vigente"])

    def test_nao_lidas_primeiro_e_depois_as_mais_recentes(self):
        futuro = self.hoje + timedelta(days=30)
        agora = timezone.now()
        for titulo, horas, lida in (
            ("Lida recente", 1, True),
            ("Não lida antiga", 48, False),
            ("Lida antiga", 72, True),
            ("Não lida recente", 2, False),
        ):
            self.avisar(
                criar_evento(titulo=titulo, data_inicio=futuro),
                criada_em=agora - timedelta(hours=horas),
                lida_em=agora if lida else None,
            )

        self.assertEqual(
            self.titulos(),
            [
                "Não lida recente",
                "Não lida antiga",
                "Lida recente",
                "Lida antiga",
            ],
        )
