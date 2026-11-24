import ast
from pathlib import Path

from django.test import SimpleTestCase

from localidades import municipios
from localidades.municipios import (
    estados,
    municipio_oficial,
    municipios_da_uf,
    sigla_do_estado,
    ufs_com_municipio,
)


class DadosDoIbgeTest(SimpleTestCase):
    def test_tem_os_27_estados_e_todos_os_municipios(self):
        self.assertEqual(len(estados()), 27)
        self.assertEqual(estados()["DF"], "Distrito Federal")
        total = sum(len(municipios_da_uf(uf)) for uf in estados())
        self.assertGreater(total, 5500)
        self.assertEqual(municipios_da_uf("DF"), ["Brasília"])

    def test_municipios_em_ordem_alfabetica_sem_acento(self):
        nomes = municipios_da_uf("SP")
        self.assertEqual(nomes[0], "Adamantina")
        self.assertLess(nomes.index("Águas de Lindóia"), nomes.index("Bauru"))

    def test_uf_inexistente_nao_tem_municipios(self):
        self.assertEqual(municipios_da_uf("XX"), [])


class MunicipioOficialTest(SimpleTestCase):
    def test_ignora_caixa_acento_e_espacos(self):
        self.assertEqual(municipio_oficial(" sao   PAULO", "sp"), "São Paulo")
        self.assertEqual(municipio_oficial("embu-guacu", "SP"), "Embu-Guaçu")

    def test_qualquer_apostrofo(self):
        for nome in ("Dias d'Ávila", "Dias d’Ávila", "dias d´avila"):
            with self.subTest(nome=nome):
                self.assertEqual(municipio_oficial(nome, "BA"), "Dias d'Ávila")

    def test_precisa_existir_na_uf(self):
        self.assertEqual(municipio_oficial("Campinas", "RJ"), "")
        self.assertEqual(municipio_oficial("Sampa", "SP"), "")
        self.assertEqual(municipio_oficial("São Paulo", ""), "")

    def test_texto_que_nao_e_string(self):
        self.assertEqual(municipio_oficial(None, "SP"), "")
        self.assertEqual(municipio_oficial("São Paulo", None), "")

    def test_nomes_que_o_photon_devolveu_para_os_locais(self):
        for cidade, uf in (
            ("Brasília", "DF"),
            ("São José", "SC"),
            ("Foz do Iguaçu", "PR"),
            ("Olinda", "PE"),
            ("Medianeira", "PR"),
        ):
            with self.subTest(cidade=cidade):
                self.assertEqual(municipio_oficial(cidade, uf), cidade)

    def test_ufs_com_municipio(self):
        self.assertEqual(ufs_com_municipio("curitiba"), ["PR"])
        self.assertEqual(len(ufs_com_municipio("Bom Jesus")), 5)
        self.assertEqual(ufs_com_municipio("Sampa"), [])


class SiglaDoEstadoTest(SimpleTestCase):
    def test_aceita_sigla_ou_nome(self):
        for texto in ("SP", "sp", " São Paulo ", "sao paulo"):
            with self.subTest(texto=texto):
                self.assertEqual(sigla_do_estado(texto), "SP")
        self.assertEqual(sigla_do_estado("Distrito Federal"), "DF")

    def test_o_que_nao_e_estado(self):
        for texto in ("", "BR", "Paulista", None):
            with self.subTest(texto=texto):
                self.assertEqual(sigla_do_estado(texto), "")


class SemDependenciasTest(SimpleTestCase):
    def test_modulo_nao_importa_outros_apps(self):
        # As migrações de dados usam este módulo; ver a docstring dele.
        arvore = ast.parse(Path(municipios.__file__).read_text())
        modulos = set()
        for no in ast.walk(arvore):
            if isinstance(no, ast.ImportFrom):
                modulos.add(no.module)
            elif isinstance(no, ast.Import):
                modulos.update(nome.name for nome in no.names)
        self.assertEqual(
            modulos, {"json", "unicodedata", "functools", "pathlib"}
        )
