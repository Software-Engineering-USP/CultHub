from django.contrib.auth import get_user_model
from django.test import TestCase

from catalogo.models import CategoriaCultural, Evento, Local, Provedor
from catalogo.tests.fabrica import criar_evento


def _inlines():
    """Formsets vazios exigidos pelo formulário do Evento."""
    return {
        f"{prefixo}-{campo}": 0
        for prefixo in ("faixas_preco", "imagens")
        for campo in ("TOTAL_FORMS", "INITIAL_FORMS")
    }


class CatalogoAdminTest(TestCase):
    def setUp(self):
        self.client.force_login(
            get_user_model().objects.create_superuser(
                email="admin@x.test", nome="Admin", password="s3nh4-forte"
            )
        )

    def _formulario(self, **campos):
        return {
            "titulo": "Feira",
            "data_inicio": "2040-03-10",
            "fuso": "America/Sao_Paulo",
            **_inlines(),
            **campos,
        }

    def test_listas_abrem(self):
        criar_evento(categorias=["music"])
        for modelo in ("evento", "local", "categoriacultural"):
            with self.subTest(modelo=modelo):
                resposta = self.client.get(f"/admin/catalogo/{modelo}/")
                self.assertEqual(resposta.status_code, 200)

    def test_filtro_de_removidos_abre(self):
        criar_evento()
        resposta = self.client.get(
            "/admin/catalogo/evento/?removido_em__isempty=1"
        )
        self.assertEqual(resposta.status_code, 200)

    def test_busca_de_evento_por_titulo(self):
        criar_evento(titulo="Feira de livros")
        criar_evento(titulo="Outro assunto")
        resposta = self.client.get("/admin/catalogo/evento/?q=feira")
        self.assertContains(resposta, "Feira de livros")
        self.assertNotContains(resposta, "Outro assunto")

    def test_cadastro_manual(self):
        musica = CategoriaCultural.objects.get(codigo="music")
        resposta = self.client.post(
            "/admin/catalogo/evento/add/",
            self._formulario(categorias=[musica.pk]),
        )
        self.assertEqual(resposta.status_code, 302)
        evento = Evento.objects.get(titulo="Feira")
        self.assertEqual(evento.provedor, Provedor.MANUAL)
        self.assertEqual(evento.id_externo, "")
        self.assertEqual(list(evento.categorias.all()), [musica])

    def test_cadastro_manual_com_preco_e_imagem(self):
        dados = self._formulario(
            **{
                "faixas_preco-TOTAL_FORMS": 1,
                "faixas_preco-0-tipo": "inteira",
                "faixas_preco-0-moeda": "BRL",
                "faixas_preco-0-minimo": "30",
                "imagens-TOTAL_FORMS": 1,
                "imagens-0-url": "https://img.test/a.jpg",
            }
        )
        resposta = self.client.post("/admin/catalogo/evento/add/", dados)
        self.assertEqual(resposta.status_code, 302)
        evento = Evento.objects.get(titulo="Feira")
        self.assertEqual(evento.faixas_preco.get().tipo, "inteira")
        self.assertEqual(evento.imagens.get().url, "https://img.test/a.jpg")

    def test_provedor_e_id_externo_nao_sao_editaveis_no_evento(self):
        evento = criar_evento(
            provedor=Provedor.TICKETMASTER, id_externo="abc", local=None
        )
        resposta = self.client.post(
            f"/admin/catalogo/evento/{evento.pk}/change/",
            self._formulario(provedor=Provedor.MANUAL, id_externo="outro"),
        )
        self.assertEqual(resposta.status_code, 302)
        evento.refresh_from_db()
        self.assertEqual(evento.titulo, "Feira")
        self.assertEqual(evento.provedor, Provedor.TICKETMASTER)
        self.assertEqual(evento.id_externo, "abc")

    def test_cadastro_de_local(self):
        resposta = self.client.post(
            "/admin/catalogo/local/add/",
            {
                "provedor": Provedor.MANUAL,
                "nome": "Sesc",
                "pais": "BR",
                "latitude": "-23.5",
                "longitude": "-46.6",
            },
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertEqual(Local.objects.get().nome, "Sesc")

    def test_local_com_coordenada_impossivel_mostra_erro(self):
        resposta = self.client.post(
            "/admin/catalogo/local/add/",
            {
                "provedor": Provedor.MANUAL,
                "nome": "Teatro",
                "pais": "BR",
                "latitude": "-123.45",
                "longitude": "500",
            },
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(Local.objects.exists())
        erros = resposta.context["adminform"].form.errors
        self.assertIn("latitude", erros)
        self.assertIn("longitude", erros)

    def test_data_que_nao_cabe_em_utc_mostra_erro(self):
        resposta = self.client.post(
            "/admin/catalogo/evento/add/",
            self._formulario(data_inicio="9999-12-31", hora_inicio="23:00"),
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertIn("data_inicio", resposta.context["adminform"].form.errors)
        self.assertFalse(Evento.objects.exists())

    def test_ano_1_em_utc_tambem_e_recusado(self):
        # Converte para UTC, mas não para o horário de São Paulo da API.
        resposta = self.client.post(
            "/admin/catalogo/evento/add/",
            self._formulario(
                data_inicio="0001-01-01", hora_inicio="01:00", fuso="UTC"
            ),
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertIn("data_inicio", resposta.context["adminform"].form.errors)
        self.assertFalse(Evento.objects.exists())

    def test_os_dois_erros_da_data_de_fim_aparecem_juntos(self):
        resposta = self.client.post(
            "/admin/catalogo/evento/add/",
            self._formulario(data_fim="0001-01-01"),
        )
        erros = resposta.context["adminform"].form.errors["data_fim"]
        self.assertEqual(len(erros), 2)
        self.assertIn("Data fora do intervalo aceito (anos 2 a 9998).", erros)
        self.assertIn("A data de fim não pode ser anterior ao início.", erros)

    def test_preco_negativo_no_admin_mostra_erro(self):
        dados = self._formulario(
            **{
                "faixas_preco-TOTAL_FORMS": 1,
                "faixas_preco-0-moeda": "BRL",
                "faixas_preco-0-minimo": "-5",
            }
        )
        resposta = self.client.post("/admin/catalogo/evento/add/", dados)
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(Evento.objects.exists())
