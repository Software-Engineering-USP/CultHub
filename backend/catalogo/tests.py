from django.test import TestCase
from rest_framework.test import APITestCase

from catalogo.models import CategoriaCultural


class CategoriasSemeadasTest(TestCase):
    def test_cinco_categorias_do_figma(self):
        pares = dict(CategoriaCultural.objects.values_list("codigo", "nome"))
        self.assertEqual(
            pares,
            {
                "music": "Música",
                "festival": "Festivais",
                "theater": "Teatro",
                "sport": "Esportes",
                "art": "Artes",
            },
        )


class CategoriasApiTest(APITestCase):
    def test_lista_publica_ordenada_por_nome(self):
        resposta = self.client.get("/api/categorias/")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            [c["nome"] for c in resposta.json()],
            ["Artes", "Esportes", "Festivais", "Música", "Teatro"],
        )
        self.assertEqual(set(resposta.json()[0]), {"codigo", "nome"})


class DocsApiTest(APITestCase):
    def test_schema_e_swagger(self):
        self.assertEqual(self.client.get("/api/schema/").status_code, 200)
        self.assertEqual(self.client.get("/api/docs/").status_code, 200)
