from datetime import time, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from agenda.models import InteresseEmEvento, PresencaEmEvento
from catalogo.tests.fabrica import criar_evento
from usuarios.models import Usuario


class ListasBase(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "ana@exemplo.com", "senha-forte-123", nome="Ana"
        )
        self.outro = Usuario.objects.create_user(
            "bia@exemplo.com", "senha-forte-123", nome="Bia"
        )
        self.client.force_login(self.usuario)
        self.hoje = timezone.localdate()

    def salvar(self, evento, usuario=None, quando=None):
        marca = InteresseEmEvento.objects.create(
            usuario=usuario or self.usuario, evento=evento
        )
        if quando:
            InteresseEmEvento.objects.filter(pk=marca.pk).update(
                marcado_em=quando
            )

    def presenca(self, evento, usuario=None):
        PresencaEmEvento.objects.create(
            usuario=usuario or self.usuario, evento=evento
        )

    def titulos(self, rota, **params):
        resposta = self.client.get(reverse(rota), params)
        self.assertEqual(resposta.status_code, 200, resposta.content)
        return [e["titulo"] for e in resposta.json()["results"]]

    def dia(self, dias):
        return self.hoje + timedelta(days=dias)


class SalvosTest(ListasBase):
    def test_salvos_do_mais_recente_para_o_mais_antigo(self):
        agora = timezone.now()
        for i, titulo in enumerate(["E1", "E2", "E3"]):
            evento = criar_evento(titulo=titulo)
            self.salvar(evento, quando=agora + timedelta(minutes=i))
        self.assertEqual(self.titulos("eu-salvos"), ["E3", "E2", "E1"])

    def test_item_tem_campos_da_agenda(self):
        evento = criar_evento()
        self.salvar(evento)
        self.presenca(evento)
        item = self.client.get(reverse("eu-salvos")).json()["results"][0]
        for chave in ("salvo", "presenca", "salvo_em", "presenca_em"):
            self.assertIn(chave, item)
        self.assertIn("removido", item)
        self.assertTrue(item["salvo"])
        self.assertTrue(item["presenca"])
        self.assertIsNotNone(item["salvo_em"])
        self.assertIsNotNone(item["presenca_em"])
        self.assertFalse(item["removido"])

    def test_salvos_inclui_removido(self):
        evento = criar_evento(removido_em=timezone.now())
        self.salvar(evento)
        item = self.client.get(reverse("eu-salvos")).json()["results"][0]
        self.assertTrue(item["removido"])


class PrivacidadeTest(ListasBase):
    def test_listas_nao_mostram_marcacoes_de_outro_usuario(self):
        evento = criar_evento(data_inicio=self.dia(1))
        self.salvar(evento, usuario=self.outro)
        self.presenca(evento, usuario=self.outro)
        parametros = {
            "eu-salvos": {},
            "eu-presencas": {"quando": "futuras"},
            "eu-agenda": {"de": self.dia(0), "ate": self.dia(5)},
        }
        for rota, params in parametros.items():
            with self.subTest(rota=rota):
                self.assertEqual(self.titulos(rota, **params), [])

    def test_listas_sem_login_respondem_403(self):
        self.client.logout()
        for rota in ("eu-salvos", "eu-presencas", "eu-agenda"):
            with self.subTest(rota=rota):
                self.assertEqual(
                    self.client.get(reverse(rota)).status_code, 403
                )


class PresencasTest(ListasBase):
    def test_presencas_futuras_e_passadas(self):
        ontem = criar_evento(titulo="ontem", data_inicio=self.dia(-1))
        amanha = criar_evento(titulo="amanhã", data_inicio=self.dia(1))
        andamento = criar_evento(
            titulo="em andamento",
            data_inicio=self.dia(-1),
            data_fim=self.dia(1),
        )
        for e in (ontem, amanha, andamento):
            self.presenca(e)
        self.assertEqual(
            self.titulos("eu-presencas", quando="futuras"),
            ["em andamento", "amanhã"],
        )
        self.assertEqual(
            self.titulos("eu-presencas", quando="passadas"), ["ontem"]
        )

    def test_presencas_passadas_ordem_decrescente(self):
        eventos = [
            criar_evento(titulo="antigo", data_inicio=self.dia(-3)),
            criar_evento(titulo="recente", data_inicio=self.dia(-1)),
            criar_evento(
                titulo="cedo", data_inicio=self.dia(-2), hora_inicio=time(9)
            ),
            criar_evento(
                titulo="tarde", data_inicio=self.dia(-2), hora_inicio=time(20)
            ),
            criar_evento(titulo="sem hora", data_inicio=self.dia(-2)),
        ]
        for e in eventos:
            self.presenca(e)
        self.assertEqual(
            self.titulos("eu-presencas", quando="passadas"),
            ["recente", "tarde", "cedo", "sem hora", "antigo"],
        )

    def test_presencas_futuras_sem_hora_por_ultimo(self):
        for titulo, hora in (("a", None), ("b", time(10)), ("c", time(8))):
            self.presenca(
                criar_evento(
                    titulo=titulo, data_inicio=self.dia(1), hora_inicio=hora
                )
            )
        self.assertEqual(
            self.titulos("eu-presencas", quando="futuras"), ["c", "b", "a"]
        )

    def test_presencas_sem_quando_ou_invalido_responde_400(self):
        for params in ({}, {"quando": "talvez"}):
            with self.subTest(params=params):
                resposta = self.client.get(reverse("eu-presencas"), params)
                self.assertEqual(resposta.status_code, 400)
                self.assertIn("quando", resposta.json())


class AgendaTest(ListasBase):
    def agenda(self, de=None, ate=None):
        return self.titulos(
            "eu-agenda", de=de or self.dia(0), ate=ate or self.dia(10)
        )

    def test_agenda_inclui_salvo_e_presenca_uma_vez_cada(self):
        so_salvo = criar_evento(titulo="salvo", data_inicio=self.dia(1))
        so_presenca = criar_evento(titulo="presença", data_inicio=self.dia(2))
        ambos = criar_evento(titulo="ambos", data_inicio=self.dia(3))
        criar_evento(titulo="nenhum", data_inicio=self.dia(4))
        self.salvar(so_salvo)
        self.presenca(so_presenca)
        self.salvar(ambos)
        self.presenca(ambos)
        self.assertEqual(self.agenda(), ["salvo", "presença", "ambos"])

    def test_agenda_inclui_evento_que_cruza_a_borda(self):
        evento = criar_evento(
            titulo="cruza", data_inicio=self.dia(-3), data_fim=self.dia(3)
        )
        self.salvar(evento)
        self.assertEqual(self.agenda(de=self.dia(0)), ["cruza"])

    def test_agenda_exclui_fora_do_periodo(self):
        antes = criar_evento(titulo="antes", data_inicio=self.dia(-5))
        depois = criar_evento(titulo="depois", data_inicio=self.dia(20))
        for e in (antes, depois):
            self.salvar(e)
        self.assertEqual(self.agenda(), [])

    def test_agenda_inclui_removido(self):
        evento = criar_evento(
            data_inicio=self.dia(1), removido_em=timezone.now()
        )
        self.salvar(evento)
        self.assertEqual(len(self.agenda()), 1)

    def test_agenda_valida_parametros(self):
        url = reverse("eu-agenda")
        de, ate = self.dia(0), self.dia(10)
        casos = [
            ({"ate": ate}, "de", None),
            ({"de": de}, "ate", None),
            (
                {"de": ate, "ate": de},
                "ate",
                "A data final não pode ser anterior à inicial.",
            ),
            (
                {"de": de, "ate": de + timedelta(days=366)},
                "ate",
                "O período pode ter no máximo 366 dias.",
            ),
        ]
        for params, campo, mensagem in casos:
            with self.subTest(params=params):
                resposta = self.client.get(url, params)
                self.assertEqual(resposta.status_code, 400)
                if mensagem:
                    self.assertEqual(resposta.json(), {campo: [mensagem]})
                else:
                    self.assertIn(campo, resposta.json())
        resposta = self.client.get(
            url, {"de": de, "ate": de + timedelta(days=365)}
        )
        self.assertEqual(resposta.status_code, 200)


class PaginacaoTest(ListasBase):
    def test_listas_paginadas(self):
        for i in range(2):
            evento = criar_evento(titulo=f"E{i}", data_inicio=self.dia(1))
            self.salvar(evento)
            self.presenca(evento)
        casos = {
            "eu-salvos": {},
            "eu-presencas": {"quando": "futuras"},
            "eu-agenda": {"de": self.dia(0), "ate": self.dia(5)},
        }
        for rota, params in casos.items():
            with self.subTest(rota=rota):
                resposta = self.client.get(
                    reverse(rota), {**params, "tamanho": 1}
                )
                corpo = resposta.json()
                self.assertEqual(corpo["count"], 2)
                self.assertIsNotNone(corpo["next"])
                self.assertEqual(len(corpo["results"]), 1)
