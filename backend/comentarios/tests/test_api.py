from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from catalogo.tests.fabrica import criar_evento
from comentarios.models import TAMANHO_MAXIMO, Comentario
from usuarios.models import Usuario


class ComentariosBase(APITestCase):
    def setUp(self):
        self.ana = Usuario.objects.create_user(
            "ana@exemplo.com", "senha-forte-123", nome="Ana Souza"
        )
        self.bia = Usuario.objects.create_user(
            "bia@exemplo.com", "senha-forte-123", nome="Bia"
        )
        self.evento = criar_evento(titulo="Show")
        self.client.force_login(self.ana)

    def lista(self, evento=None):
        return reverse("evento-comentarios", args=[(evento or self.evento).pk])

    def comentar(self, texto="Ótimo show", autor=None, resposta_a=None):
        return Comentario.objects.create(
            evento=self.evento,
            autor=autor or self.ana,
            resposta_a=resposta_a,
            texto=texto,
        )


class ListarTest(ComentariosBase):
    def test_lista_e_publica_com_respostas_aninhadas(self):
        raiz = self.comentar("Primeiro")
        self.comentar("Resposta", autor=self.bia, resposta_a=raiz)
        self.client.logout()

        resposta = self.client.get(self.lista())

        self.assertEqual(resposta.status_code, 200)
        [comentario] = resposta.json()["results"]
        self.assertEqual(comentario["texto"], "Primeiro")
        self.assertEqual(
            comentario["autor"],
            {"id": str(self.ana.pk), "nome": "Ana Souza", "iniciais": "AS"},
        )
        self.assertFalse(comentario["meu"])
        [filha] = comentario["respostas"]
        self.assertEqual(filha["texto"], "Resposta")
        self.assertEqual(filha["nivel"], 1)
        self.assertEqual(filha["resposta_a"], str(raiz.pk))

    def test_comentarios_mais_recentes_primeiro_e_respostas_em_ordem(self):
        antigo = self.comentar("Antigo")
        self.comentar("Novo")
        primeira = self.comentar("1ª", resposta_a=antigo)
        segunda = self.comentar("2ª", resposta_a=antigo)
        Comentario.objects.filter(pk=segunda.pk).update(
            criado_em=primeira.criado_em + timezone.timedelta(minutes=1)
        )
        Comentario.objects.filter(texto="Novo").update(
            criado_em=antigo.criado_em + timezone.timedelta(hours=1)
        )

        dados = self.client.get(self.lista()).json()["results"]

        self.assertEqual([c["texto"] for c in dados], ["Novo", "Antigo"])
        self.assertEqual(
            [r["texto"] for r in dados[1]["respostas"]], ["1ª", "2ª"]
        )

    def test_marca_os_comentarios_do_usuario_logado(self):
        self.comentar("Meu")
        self.comentar("Da Bia", autor=self.bia)
        dados = self.client.get(self.lista()).json()["results"]
        self.assertEqual(
            {c["texto"]: c["meu"] for c in dados},
            {
                "Meu": True,
                "Da Bia": False,
            },
        )

    def test_removido_aparece_sem_texto_so_enquanto_tem_respostas(self):
        com_resposta = self.comentar("Some o texto")
        self.comentar("Fica", autor=self.bia, resposta_a=com_resposta)
        sozinho = self.comentar("Some tudo")
        Comentario.objects.filter(pk__in=[com_resposta.pk, sozinho.pk]).update(
            removido_em=timezone.now(), texto=""
        )

        [comentario] = self.client.get(self.lista()).json()["results"]

        self.assertTrue(comentario["removido"])
        self.assertIsNone(comentario["texto"])
        self.assertIsNone(comentario["autor"])
        self.assertFalse(comentario["meu"])
        self.assertEqual(comentario["respostas"][0]["texto"], "Fica")

    def remover(self, *comentarios):
        Comentario.objects.filter(pk__in=[c.pk for c in comentarios]).update(
            removido_em=timezone.now(), texto=""
        )

    def test_some_quando_todas_as_respostas_tambem_foram_removidas(self):
        raiz = self.comentar()
        resposta = self.comentar(resposta_a=raiz)
        self.remover(raiz, resposta)
        self.assertEqual(self.client.get(self.lista()).json()["results"], [])

    def test_paginacao_conta_so_os_que_aparecem(self):
        for _ in range(21):
            self.comentar()
        self.remover(*[self.comentar() for _ in range(3)])

        dados = self.client.get(self.lista()).json()

        self.assertEqual(dados["count"], 21)
        self.assertEqual(len(dados["results"]), 20)
        self.assertIsNotNone(dados["next"])

    @override_settings(COMENTARIOS_PROFUNDIDADE_MAXIMA=2)
    def test_removido_aparece_se_um_neto_continua_visivel(self):
        raiz = self.comentar("Raiz")
        filho = self.comentar("Filho", resposta_a=raiz)
        self.comentar("Neto", resposta_a=filho)
        self.remover(raiz, filho)

        [dados] = self.client.get(self.lista()).json()["results"]

        self.assertTrue(dados["removido"])
        self.assertTrue(dados["respostas"][0]["removido"])
        self.assertEqual(
            dados["respostas"][0]["respostas"][0]["texto"], "Neto"
        )

    def test_autor_que_apagou_a_conta_aparece_sem_autor(self):
        self.comentar(autor=self.bia)
        self.bia.delete()
        [comentario] = self.client.get(self.lista()).json()["results"]
        self.assertIsNone(comentario["autor"])

    def test_consultas_nao_crescem_com_o_numero_de_respostas(self):
        def consultas():
            with CaptureQueriesContext(connection) as contexto:
                self.client.get(self.lista())
            return len(contexto.captured_queries)

        raiz = self.comentar()
        self.comentar(resposta_a=raiz)
        com_poucas = consultas()
        for _ in range(5):
            self.comentar(resposta_a=self.comentar())

        self.assertEqual(consultas(), com_poucas)

    def test_evento_inexistente_responde_404(self):
        evento = criar_evento()
        url = self.lista(evento)
        evento.delete()
        self.assertEqual(self.client.get(url).status_code, 404)

    @override_settings(COMENTARIOS_PROFUNDIDADE_MAXIMA=2)
    def test_arvore_aparece_aninhada_ate_o_limite(self):
        raiz = self.comentar("Raiz")
        n1 = self.comentar("N1", resposta_a=raiz)
        self.comentar("N2", resposta_a=n1)

        [dados] = self.client.get(self.lista()).json()["results"]

        self.assertEqual(dados["respostas"][0]["respostas"][0]["texto"], "N2")


class CriarTest(ComentariosBase):
    def test_cria_comentario_do_usuario_logado(self):
        resposta = self.client.post(
            self.lista(), {"texto": "  Adorei!  "}, format="json"
        )

        self.assertEqual(resposta.status_code, 201)
        self.assertEqual(resposta.json()["texto"], "Adorei!")
        self.assertTrue(resposta.json()["meu"])
        self.assertEqual(Comentario.objects.get().autor, self.ana)

    def test_sem_login_nao_comenta(self):
        self.client.logout()
        resposta = self.client.post(self.lista(), {"texto": "Oi"})
        self.assertEqual(resposta.status_code, 403)

    def test_valida_o_texto(self):
        vazio = self.client.post(self.lista(), {"texto": "   "})
        longo = self.client.post(
            self.lista(), {"texto": "a" * (TAMANHO_MAXIMO + 1)}
        )

        self.assertEqual(vazio.status_code, 400)
        self.assertEqual(
            vazio.json(), {"texto": ["Escreva algo antes de enviar."]}
        )
        self.assertEqual(longo.status_code, 400)
        self.assertFalse(Comentario.objects.exists())

    def test_evento_removido_nao_recebe_comentario(self):
        self.evento.removido_em = timezone.now()
        self.evento.save(update_fields=("removido_em",))
        resposta = self.client.post(self.lista(), {"texto": "Oi"})
        self.assertEqual(resposta.status_code, 409)


class ResponderTest(ComentariosBase):
    def url(self, comentario):
        return reverse("comentario-respostas", args=[comentario.pk])

    def test_responde_e_resposta_de_resposta_vai_para_o_comentario(self):
        raiz = self.comentar(autor=self.bia)
        primeira = self.client.post(self.url(raiz), {"texto": "Concordo"})
        filha = Comentario.objects.get(pk=primeira.json()["id"])

        segunda = self.client.post(self.url(filha), {"texto": "Eu também"})

        self.assertEqual(primeira.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(segunda.json()["resposta_a"], str(raiz.pk))
        self.assertEqual(segunda.json()["nivel"], 1)

    def test_responde_a_comentario_removido_pelos_dois_caminhos(self):
        raiz = self.comentar("Raiz")
        filha = self.comentar("Filha", autor=self.bia, resposta_a=raiz)
        raiz.removido_em = timezone.now()
        raiz.save()

        direto = self.client.post(self.url(raiz), {"texto": "Direto"})
        pela_filha = self.client.post(self.url(filha), {"texto": "Pela filha"})

        self.assertEqual(
            (direto.status_code, pela_filha.status_code), (201, 201)
        )
        # Com um nível de resposta, as duas ficam embaixo do removido.
        self.assertEqual(direto.json()["resposta_a"], str(raiz.pk))
        self.assertEqual(pela_filha.json()["resposta_a"], str(raiz.pk))
        [dados] = self.client.get(self.lista()).json()["results"]
        self.assertTrue(dados["removido"])
        # A ordem das respostas não é o que este teste confere.
        self.assertCountEqual(
            [r["texto"] for r in dados["respostas"]],
            ["Filha", "Direto", "Pela filha"],
        )

    def test_evento_removido_nao_recebe_resposta(self):
        ativo = self.comentar()
        self.evento.removido_em = timezone.now()
        self.evento.save(update_fields=("removido_em",))
        resposta = self.client.post(self.url(ativo), {"texto": "x"})
        self.assertEqual(resposta.status_code, 409)
        self.assertEqual(
            resposta.json()["detail"], "Este evento foi removido do catálogo."
        )

    def test_valida_texto_e_exige_login(self):
        raiz = self.comentar()
        self.assertEqual(
            self.client.post(self.url(raiz), {"texto": ""}).status_code, 400
        )
        self.client.logout()
        self.assertEqual(
            self.client.post(self.url(raiz), {"texto": "x"}).status_code, 403
        )


class EditarERemoverTest(ComentariosBase):
    def url(self, comentario):
        return reverse("comentario", args=[comentario.pk])

    def test_autor_edita_e_fica_marcado_como_editado(self):
        comentario = self.comentar("Antes")
        resposta = self.client.patch(
            self.url(comentario), {"texto": "Depois"}, format="json"
        )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["texto"], "Depois")
        self.assertIsNotNone(resposta.json()["editado_em"])

    def test_editar_nao_muda_a_quem_a_resposta_responde(self):
        with override_settings(COMENTARIOS_PROFUNDIDADE_MAXIMA=2):
            filho = self.comentar(resposta_a=self.comentar())
            neto = self.comentar(resposta_a=filho)
        # Com o limite reduzido depois, a resposta antiga fica onde estava.
        self.client.patch(self.url(neto), {"texto": "Novo"}, format="json")
        neto.refresh_from_db()
        self.assertEqual((neto.resposta_a, neto.nivel), (filho, 2))

    def test_outra_pessoa_nao_edita_nem_remove(self):
        comentario = self.comentar(autor=self.bia)
        editar = self.client.patch(self.url(comentario), {"texto": "x"})
        remover = self.client.delete(self.url(comentario))

        self.assertEqual(editar.status_code, 403)
        self.assertEqual(
            editar.json()["detail"],
            "Só quem escreveu o comentário pode alterá-lo.",
        )
        self.assertEqual(remover.status_code, 403)

    def test_edicao_valida_o_texto(self):
        comentario = self.comentar()
        resposta = self.client.patch(self.url(comentario), {"texto": ""})
        self.assertEqual(resposta.status_code, 400)

    def test_remover_apaga_o_texto_mas_mantem_as_respostas(self):
        comentario = self.comentar("Some")
        self.comentar("Fica", autor=self.bia, resposta_a=comentario)

        resposta = self.client.delete(self.url(comentario))

        self.assertEqual(resposta.status_code, 204)
        comentario.refresh_from_db()
        self.assertTrue(comentario.removido)
        self.assertEqual(comentario.texto, "")
        self.assertEqual(comentario.respostas.count(), 1)

    def test_comentario_removido_nao_e_editado_nem_removido_de_novo(self):
        comentario = self.comentar()
        self.client.delete(self.url(comentario))
        self.assertEqual(
            self.client.patch(
                self.url(comentario), {"texto": "x"}
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(self.url(comentario)).status_code, 404
        )


class MeusComentariosTest(ComentariosBase):
    def test_lista_os_comentarios_do_usuario_com_o_evento(self):
        raiz = self.comentar("Meu", autor=self.ana)
        self.comentar("Minha resposta", autor=self.ana, resposta_a=raiz)
        self.comentar("Da Bia", autor=self.bia)
        removido = self.comentar("Removido", autor=self.ana)
        removido.removido_em = timezone.now()
        removido.save()

        dados = self.client.get(reverse("eu-comentarios")).json()["results"]

        self.assertEqual(
            sorted(c["texto"] for c in dados), ["Meu", "Minha resposta"]
        )
        self.assertEqual(
            dados[0]["evento"], {"id": str(self.evento.pk), "titulo": "Show"}
        )

    def test_exige_login(self):
        self.client.logout()
        self.assertEqual(
            self.client.get(reverse("eu-comentarios")).status_code, 403
        )


class LimiteTest(ComentariosBase):
    def setUp(self):
        super().setUp()
        cache.clear()

    @patch.object(
        ScopedRateThrottle, "THROTTLE_RATES", {"comentario": "2/min"}
    )
    def test_limita_a_escrita_mas_nao_a_leitura(self):
        respostas = [
            self.client.post(self.lista(), {"texto": "x"}).status_code
            for _ in range(3)
        ]

        self.assertEqual(respostas, [201, 201, 429])
        self.assertEqual(self.client.get(self.lista()).status_code, 200)
