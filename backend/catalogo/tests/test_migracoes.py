from decimal import Decimal
from importlib import import_module

from django.apps import apps
from django.db import connection
from django.test import TestCase

from catalogo.models import FaixaPreco, Local, Provedor
from catalogo.tests.fabrica import criar_evento

limpar_valores_invalidos = import_module(
    "catalogo.migrations.0005_validar_valores"
).limpar_valores_invalidos


class LimparValoresInvalidosTest(TestCase):
    def test_apaga_precos_e_coordenadas_fora_da_faixa(self):
        evento = criar_evento()
        boa = FaixaPreco.objects.create(evento=evento, minimo=10, maximo=20)
        ruim = FaixaPreco.objects.create(evento=evento, minimo=10, maximo=20)
        # `update` grava sem validar. Preço acima do tamanho da coluna só o
        # SQLite aceita (o Postgres recusa com "numeric field overflow");
        # negativo e coordenadas impossíveis cabem nos dois.
        gigante = connection.vendor == "sqlite"
        FaixaPreco.objects.filter(pk=ruim.pk).update(
            minimo=Decimal(100000000) if gigante else Decimal(-5),
            maximo=Decimal(-1),
        )
        local_ruim = Local.objects.create(nome="Ruim")
        Local.objects.filter(pk=local_ruim.pk).update(
            latitude=Decimal("-123.45"), longitude=Decimal(500)
        )

        limpar_valores_invalidos(apps, None)

        ruim.refresh_from_db()
        self.assertEqual((ruim.minimo, ruim.maximo), (None, None))
        boa.refresh_from_db()
        self.assertEqual((boa.minimo, boa.maximo), (10, 20))
        local_ruim.refresh_from_db()
        self.assertEqual(
            (local_ruim.latitude, local_ruim.longitude), (None, None)
        )
        self.assertIsNotNone(evento.local.latitude)


limpar_cidades = import_module(
    "catalogo.migrations.0007_limpar_cidades_invalidas"
).limpar_cidades


class LimparCidadesInvalidasTest(TestCase):
    def criar(self, nome, cidade, estado="SP", **campos):
        campos.setdefault("provedor", Provedor.TICKETMASTER)
        return Local.objects.create(
            nome=nome,
            id_externo=nome,
            cidade=cidade,
            estado=estado,
            **campos,
        )

    def test_so_fica_municipio_do_ibge_com_o_nome_oficial(self):
        invalida = self.criar("a", "Nocity")
        outra_uf = self.criar("b", "Curitiba")
        sem_acento = self.criar("c", "sao paulo")
        valida = self.criar("d", "Ribeirão Preto")
        manual = self.criar("e", "Sampa", provedor=Provedor.MANUAL)
        de_fora = self.criar("f", "Buenos Aires", estado="", pais="AR")
        sem_estado = self.criar("g", "Bom Jesus", estado="")
        ambigua_errada = self.criar("h", "Bom Jesus")
        bairro = self.criar("i", "Pinheiros")
        sem_estado_com_coordenada = self.criar(
            "j",
            "Bom Jesus",
            estado="",
            latitude=Decimal("-28.6"),
            longitude=Decimal("-50.4"),
        )

        limpar_cidades(apps, None)

        for local, esperada in (
            (invalida, ("", "SP")),
            (outra_uf, ("", "SP")),
            (sem_acento, ("São Paulo", "SP")),
            (valida, ("Ribeirão Preto", "SP")),
            (manual, ("Sampa", "SP")),
            (de_fora, ("Buenos Aires", "")),
            (sem_estado, ("Bom Jesus", "")),
            (ambigua_errada, ("", "SP")),
            (bairro, ("", "SP")),
            (sem_estado_com_coordenada, ("", "")),
        ):
            local.refresh_from_db()
            self.assertEqual((local.cidade, local.estado), esperada)
