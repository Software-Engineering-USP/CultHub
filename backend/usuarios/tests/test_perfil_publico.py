import uuid

from django.utils import timezone
from rest_framework.test import APITestCase

from catalogo.models import CategoriaCultural
from usuarios.models import Usuario


class PerfilPublicoTest(APITestCase):
    def setUp(self):
        self.eu = Usuario.objects.create_user(
            "livia@exemplo.com", "senha1234", nome="Lívia Costa"
        )
        self.outra = Usuario.objects.create_user(
            "caio@exemplo.com",
            "senha1234",
            nome="Caio Prado",
            cidade="São Paulo, SP",
            bairro="Butantã",
        )
        self.client.force_login(self.eu)

    def url(self, pk):
        return f"/api/usuarios/{pk}/"

    def test_devolve_so_os_campos_publicos(self):
        resposta = self.client.get(self.url(self.outra.pk))
        self.assertEqual(resposta.status_code, 200)
        dados = resposta.json()
        self.assertEqual(
            set(dados),
            {
                "id",
                "nome",
                "iniciais",
                "cidade",
                "preferencias",
                "membro_desde",
            },
        )
        self.assertEqual(dados["id"], str(self.outra.pk))
        self.assertEqual(dados["nome"], "Caio Prado")
        self.assertEqual(dados["iniciais"], "CP")
        self.assertEqual(dados["cidade"], "São Paulo, SP")
        self.assertEqual(
            dados["membro_desde"],
            timezone.localdate(self.outra.criado_em).isoformat(),
        )

    def test_nao_vaza_email_nem_bairro(self):
        corpo = self.client.get(self.url(self.outra.pk)).content.decode()
        self.assertNotIn("caio@exemplo.com", corpo)
        self.assertNotIn("Butantã", corpo)

    def test_preferencias_pelo_codigo(self):
        categorias = [
            CategoriaCultural.objects.get_or_create(
                codigo=codigo, defaults={"nome": nome}
            )[0]
            for codigo, nome in (("music", "Música"), ("art", "Arte"))
        ]
        self.outra.preferencias.set(categorias)
        dados = self.client.get(self.url(self.outra.pk)).json()
        self.assertEqual(set(dados["preferencias"]), {"music", "art"})

    def test_proprio_perfil(self):
        resposta = self.client.get(self.url(self.eu.pk))
        self.assertEqual(resposta.status_code, 200)
        self.assertNotIn("email", resposta.json())

    def test_sem_login(self):
        self.client.logout()
        resposta = self.client.get(self.url(self.outra.pk))
        self.assertEqual(resposta.status_code, 403)

    def test_usuario_inexistente(self):
        resposta = self.client.get(self.url(uuid.uuid4()))
        self.assertEqual(resposta.status_code, 404)

    def test_id_malformado(self):
        resposta = self.client.get("/api/usuarios/123/")
        self.assertEqual(resposta.status_code, 404)

    def test_conta_desativada(self):
        self.outra.is_active = False
        self.outra.save()
        resposta = self.client.get(self.url(self.outra.pk))
        self.assertEqual(resposta.status_code, 404)

    def test_nao_aceita_escrita(self):
        for metodo in ("put", "patch", "delete", "post"):
            resposta = getattr(self.client, metodo)(
                self.url(self.outra.pk), {"nome": "Outro"}, format="json"
            )
            self.assertEqual(resposta.status_code, 405, metodo)
        self.outra.refresh_from_db()
        self.assertEqual(self.outra.nome, "Caio Prado")
