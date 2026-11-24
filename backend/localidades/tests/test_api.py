from rest_framework.test import APITestCase


class LocalidadesApiTest(APITestCase):
    def test_estados_sem_login(self):
        resposta = self.client.get("/api/localidades/estados/")
        self.assertEqual(resposta.status_code, 200)
        dados = resposta.json()
        self.assertEqual(len(dados), 27)
        self.assertEqual(dados[0], {"sigla": "AC", "nome": "Acre"})
        self.assertIn("max-age=86400", resposta["Cache-Control"])

    def test_municipios_da_uf(self):
        resposta = self.client.get("/api/localidades/municipios/?uf=sp")
        self.assertEqual(resposta.status_code, 200)
        nomes = resposta.json()
        self.assertIn("São Paulo", nomes)
        self.assertNotIn("Niterói", nomes)
        self.assertIn("public", resposta["Cache-Control"])

    def test_municipios_sem_uf_ou_com_uf_inexistente(self):
        for consulta in ("", "?uf=", "?uf=XX", "?uf=São Paulo"):
            with self.subTest(consulta=consulta):
                resposta = self.client.get(
                    f"/api/localidades/municipios/{consulta}"
                )
                self.assertEqual(resposta.status_code, 400)
                self.assertEqual(
                    resposta.json(),
                    {"uf": ["Informe a sigla de um estado (ex.: SP)."]},
                )
