from rest_framework.test import APITestCase

from usuarios.models import Usuario


class PerfilTest(APITestCase):
    url = "/api/eu/"

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "livia@exemplo.com", "senha1234", nome="Lívia Costa"
        )
        self.client.force_login(self.usuario)

    def patch(self, dados):
        return self.client.patch(self.url, dados, format="json")

    def test_get_perfil(self):
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            set(resposta.json()),
            {
                "id",
                "nome",
                "email",
                "cidade",
                "estado",
                "bairro",
                "preferencias",
                "iniciais",
            },
        )
        self.assertEqual(resposta.json()["id"], str(self.usuario.pk))

    def test_get_sem_login(self):
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_patch_dados_pessoais(self):
        resposta = self.patch(
            {
                "nome": "Lívia C. Souza",
                "cidade": "São Paulo",
                "estado": "SP",
                "bairro": "Vila Mariana",
            }
        )
        self.assertEqual(resposta.status_code, 200)
        dados = resposta.json()
        self.assertEqual(dados["nome"], "Lívia C. Souza")
        self.assertEqual(dados["cidade"], "São Paulo")
        self.assertEqual(dados["estado"], "SP")
        self.assertEqual(dados["bairro"], "Vila Mariana")
        self.assertEqual(dados["iniciais"], "LS")
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.bairro, "Vila Mariana")

    def test_patch_preferencias_substitui(self):
        self.assertEqual(
            self.patch({"preferencias": ["music", "art"]}).status_code, 200
        )
        resposta = self.patch({"preferencias": ["theater"]})
        self.assertEqual(resposta.json()["preferencias"], ["theater"])

    def test_patch_preferencias_vazia(self):
        self.patch({"preferencias": ["music"]})
        resposta = self.patch({"preferencias": []})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["preferencias"], [])

    def test_patch_preferencia_inexistente(self):
        self.patch({"preferencias": ["music"]})
        resposta = self.patch({"preferencias": ["jazz"]})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("preferencias", resposta.json())
        self.assertEqual(
            self.client.get(self.url).json()["preferencias"], ["music"]
        )

    def test_patch_email_ignorado(self):
        resposta = self.patch({"email": "outro@exemplo.com"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["email"], "livia@exemplo.com")

    def test_patch_nome_em_branco(self):
        resposta = self.patch({"nome": "  "})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("nome", resposta.json())

    def test_put_nao_permitido(self):
        resposta = self.client.put(self.url, {"nome": "X"}, format="json")
        self.assertEqual(resposta.status_code, 405)


class LocalidadeDoPerfilTest(APITestCase):
    url = "/api/eu/"

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            "livia@exemplo.com", "senha1234", nome="Lívia Costa"
        )
        self.client.force_login(self.usuario)

    def patch(self, dados):
        return self.client.patch(self.url, dados, format="json")

    def assertLocalidade(self, cidade, estado):
        self.usuario.refresh_from_db()
        self.assertEqual(
            (self.usuario.cidade, self.usuario.estado), (cidade, estado)
        )

    def test_grava_o_nome_oficial_do_municipio(self):
        resposta = self.patch({"cidade": "  sao   PAULO ", "estado": "SP"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["cidade"], "São Paulo")
        self.assertLocalidade("São Paulo", "SP")

    def test_recusa_cidade_que_nao_existe_no_estado(self):
        resposta = self.patch({"cidade": "Campinas", "estado": "RJ"})
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(
            resposta.json(),
            {"cidade": ["Não há um município com esse nome em RJ."]},
        )
        self.assertLocalidade("", "")

    def test_recusa_texto_livre_antigo(self):
        resposta = self.patch({"cidade": "São Paulo, SP", "estado": "SP"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("cidade", resposta.json())

    def test_cidade_exige_estado(self):
        resposta = self.patch({"cidade": "Campinas"})
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(
            resposta.json(), {"estado": ["Escolha o estado da cidade."]}
        )

    def test_recusa_estado_inexistente(self):
        resposta = self.patch({"estado": "XX"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("estado", resposta.json())

    def test_estado_sem_cidade_vale(self):
        self.assertEqual(self.patch({"estado": "MG"}).status_code, 200)
        self.assertLocalidade("", "MG")

    def test_trocar_so_o_estado_confere_a_cidade_que_ja_estava(self):
        self.patch({"cidade": "Campinas", "estado": "SP"})
        resposta = self.patch({"estado": "RJ"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("cidade", resposta.json())
        self.assertLocalidade("Campinas", "SP")

    def test_trocar_so_a_cidade_confere_o_estado_que_ja_estava(self):
        self.patch({"cidade": "Campinas", "estado": "SP"})
        self.assertEqual(self.patch({"cidade": "santos"}).status_code, 200)
        self.assertLocalidade("Santos", "SP")
        self.assertEqual(self.patch({"cidade": "Niterói"}).status_code, 400)

    def test_limpar_a_cidade_mantem_o_estado(self):
        self.patch({"cidade": "Campinas", "estado": "SP"})
        self.assertEqual(self.patch({"cidade": ""}).status_code, 200)
        self.assertLocalidade("", "SP")

    def test_limpar_os_dois(self):
        self.patch({"cidade": "Campinas", "estado": "SP"})
        resposta = self.patch({"cidade": "", "estado": ""})
        self.assertEqual(resposta.status_code, 200)
        self.assertLocalidade("", "")

    def test_limpar_so_o_estado_com_cidade_e_recusado(self):
        self.patch({"cidade": "Campinas", "estado": "SP"})
        self.assertEqual(self.patch({"estado": ""}).status_code, 400)
        self.assertLocalidade("Campinas", "SP")

    def test_patch_sem_localidade_nao_mexe_nela(self):
        self.patch({"cidade": "Campinas", "estado": "SP"})
        self.assertEqual(self.patch({"nome": "Lívia"}).status_code, 200)
        self.assertLocalidade("Campinas", "SP")
