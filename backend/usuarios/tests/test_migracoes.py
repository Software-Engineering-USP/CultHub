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
            migracao.localidade("Embu-Guaçu - SP"), ("Embu-Guaçu", "SP")
        )

    def test_so_a_uf(self):
        self.assertEqual(migracao.localidade("rj"), ("", "RJ"))

    def test_sem_uf_no_texto_a_uf_nao_e_deduzida(self):
        # O nome pode ser de um bairro: Moema é município de MG e bairro
        # de São Paulo; Pinheiros, município do ES.
        for texto, esperado in (
            ("Moema", ("Moema", "")),
            ("Pinheiros", ("Pinheiros", "")),
            ("Curitiba", ("Curitiba", "")),
            ("São Paulo, BR", ("São Paulo", "")),
            ("bom jesus", ("Bom Jesus", "")),
            ("Embu-Guaçu", ("Embu-Guaçu", "")),
        ):
            with self.subTest(texto=texto):
                self.assertEqual(migracao.localidade(texto), esperado)

    def test_cidade_que_nao_existe_na_uf_mantem_so_a_uf(self):
        self.assertEqual(migracao.localidade("Sampa, SP"), ("", "SP"))
        self.assertEqual(migracao.localidade("Curitiba, SP"), ("", "SP"))
        # Mesma regra dos locais: a UF escrita não é trocada.
        self.assertEqual(migracao.localidade("Medianeira, PB"), ("", "PB"))

    def test_estado_por_extenso(self):
        for texto, esperado in (
            ("Pinheiros, São Paulo", ("", "SP")),
            ("Bom Jesus, Piauí", ("Bom Jesus", "PI")),
            ("bom jesus - piaui", ("Bom Jesus", "PI")),
            ("Curitiba / Paraná", ("Curitiba", "PR")),
            ("Paraná", ("", "PR")),
            # Nome de estado que também é município dele é a cidade.
            ("São Paulo", ("São Paulo", "SP")),
        ):
            with self.subTest(texto=texto):
                self.assertEqual(migracao.localidade(texto), esperado)

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
