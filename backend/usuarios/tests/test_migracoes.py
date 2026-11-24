from importlib import import_module

from django.apps import apps
from django.test import SimpleTestCase, TestCase

from usuarios.models import Usuario

migracao = import_module("usuarios.migrations.0003_converter_cidade")


class LocalidadeDoTextoAntigoTest(SimpleTestCase):
    def test_cidade_com_uf_em_varios_formatos(self):
        for texto in (
            "São Paulo, SP",
            "sao paulo - sp",
            "São Paulo-SP",
            "São Paulo – SP",
            "são paulo/SP",
            "SAO PAULO SP",
        ):
            with self.subTest(texto=texto):
                self.assertEqual(
                    migracao.localidade(texto), ("São Paulo", "SP")
                )

    def test_hifen_no_nome_nao_vira_separador(self):
        self.assertEqual(
            migracao.localidade("Embu-Guaçu"), ("Embu-Guaçu", "SP")
        )

    def test_so_a_uf(self):
        self.assertEqual(migracao.localidade("rj"), ("", "RJ"))

    def test_cidade_sem_uf_que_so_existe_em_um_estado(self):
        self.assertEqual(migracao.localidade("Curitiba"), ("Curitiba", "PR"))
        self.assertEqual(
            migracao.localidade("São Paulo, BR"), ("São Paulo", "SP")
        )

    def test_cidade_sem_uf_que_existe_em_varios_estados_fica_sem_uf(self):
        self.assertEqual(migracao.localidade("bom jesus"), ("Bom Jesus", ""))

    def test_cidade_que_nao_existe_na_uf_mantem_so_a_uf(self):
        self.assertEqual(migracao.localidade("Sampa, SP"), ("", "SP"))
        self.assertEqual(migracao.localidade("Curitiba, SP"), ("", "SP"))
        # Mesma regra dos locais: a UF escrita não é trocada.
        self.assertEqual(migracao.localidade("Medianeira, PB"), ("", "PB"))

    def test_texto_irreconhecivel_fica_em_branco(self):
        for texto in ("Sampa", "SP capital", "BR", ",", ""):
            with self.subTest(texto=texto):
                cidade, _ = migracao.localidade(texto)
                self.assertEqual(cidade, "")
        self.assertEqual(migracao.localidade("Sampa"), ("", ""))


class ConverterCidadesTest(TestCase):
    def criar(self, nome, cidade):
        return Usuario.objects.create_user(
            f"{nome}@exemplo.com", "senha1234", nome=nome, cidade=cidade
        )

    def test_converte_todos_os_perfis_com_cidade(self):
        ana = self.criar("ana", "Bom Jesus, RS")
        bia = self.criar("bia", "Sampa")
        caio = self.criar("caio", "")

        migracao.converter_cidades(apps, None)

        for usuario, esperado in (
            (ana, ("Bom Jesus", "RS")),
            (bia, ("", "")),
            (caio, ("", "")),
        ):
            usuario.refresh_from_db()
            self.assertEqual((usuario.cidade, usuario.estado), esperado)
