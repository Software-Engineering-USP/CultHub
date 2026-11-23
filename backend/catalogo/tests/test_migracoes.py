from decimal import Decimal
from importlib import import_module

from django.apps import apps
from django.test import TestCase

from catalogo.models import FaixaPreco, Local
from catalogo.tests.fabrica import criar_evento

limpar_valores_invalidos = import_module(
    "catalogo.migrations.0005_validar_valores"
).limpar_valores_invalidos


class LimparValoresInvalidosTest(TestCase):
    def test_apaga_precos_e_coordenadas_fora_da_faixa(self):
        evento = criar_evento()
        boa = FaixaPreco.objects.create(evento=evento, minimo=10, maximo=20)
        ruim = FaixaPreco.objects.create(evento=evento, minimo=10, maximo=20)
        # `update` grava sem validar, como o SQLite aceitava na importação.
        FaixaPreco.objects.filter(pk=ruim.pk).update(
            minimo=Decimal(100000000), maximo=Decimal(-1)
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
