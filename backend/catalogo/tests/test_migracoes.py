from decimal import Decimal
from importlib import import_module

from django.apps import apps
from django.db import connection
from django.test import TestCase
from django.utils import timezone

from catalogo.models import FaixaPreco, Local, Provedor
from catalogo.tests.fabrica import criar_evento

geocodificar_de_novo = import_module(
    "catalogo.migrations.0008_local_resposta_do_photon"
).geocodificar_de_novo
copiar_e_geocodificar_de_novo = import_module(
    "catalogo.migrations.0009_local_dados_informados"
).copiar_e_geocodificar_de_novo
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
        coordenada = {
            "latitude": Decimal("-23.5"),
            "longitude": Decimal("-46.6"),
        }
        sem_estado_com_coordenada = self.criar(
            "j", "Bom Jesus", estado="", **coordenada
        )
        bairro_sem_estado = self.criar("k", "Pinheiros", estado="")
        bairro_sem_estado_com_coordenada = self.criar(
            "l", "Pinheiros", estado="", **coordenada
        )
        uf_invalida = self.criar("m", "", estado="XX")
        uf_minuscula = self.criar("o", "Santos", estado="sp")
        so_latitude = self.criar(
            "p", "Curitiba", estado="", latitude=Decimal("-25.4")
        )
        curitiba_com_coordenada = self.criar(
            "q", "curitiba", estado="", **coordenada
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
            (sem_estado_com_coordenada, ("Bom Jesus", "")),
            # O nome nunca completa a UF, com ou sem coordenada.
            (bairro_sem_estado, ("Pinheiros", "")),
            # Com coordenada, fica o nome como palpite para o Photon.
            (bairro_sem_estado_com_coordenada, ("Pinheiros", "")),
            (uf_invalida, ("", "")),
            (uf_minuscula, ("Santos", "SP")),
            (so_latitude, ("Curitiba", "")),
            (curitiba_com_coordenada, ("Curitiba", "")),
        ):
            local.refresh_from_db()
            self.assertEqual((local.cidade, local.estado), esperada)


class GeocodificarDeNovoTest(TestCase):
    def criar(self, nome, **campos):
        return Local.objects.create(
            nome=nome,
            provedor=Provedor.TICKETMASTER,
            id_externo=nome,
            cidade="Medianeira",
            estado="PR",
            geocodificado_em=timezone.now(),
            **campos,
        )

    def test_0008_devolve_a_fila_so_os_que_tem_coordenada(self):
        com_coordenada = self.criar(
            "a", latitude=Decimal("-25.3"), longitude=Decimal("-54.1")
        )
        sem_coordenada = self.criar("b")

        geocodificar_de_novo(apps, None)

        com_coordenada.refresh_from_db()
        sem_coordenada.refresh_from_db()
        self.assertIsNone(com_coordenada.geocodificado_em)
        self.assertIsNotNone(sem_coordenada.geocodificado_em)

    def test_0009_copia_a_entrada_e_devolve_todos_a_fila(self):
        # Até mesmo com cidade e UF completas: antes, esses ficavam fora da
        # fila e a importação seguinte gravaria o Ticketmaster por cima.
        completo = self.criar(
            "a", latitude=Decimal("-25.3"), longitude=Decimal("-54.1")
        )
        sem_coordenada = self.criar("b")
        manual = Local.objects.create(
            nome="c", provedor=Provedor.MANUAL, cidade="Santos", estado="SP"
        )

        copiar_e_geocodificar_de_novo(apps, None)

        for local in (completo, sem_coordenada, manual):
            local.refresh_from_db()
        self.assertEqual(
            (completo.cidade_informada, completo.estado_informado),
            ("Medianeira", "PR"),
        )
        self.assertIsNone(completo.geocodificado_em)
        self.assertIsNotNone(sem_coordenada.geocodificado_em)
        self.assertEqual(manual.cidade_informada, "")

    def test_0009_guarda_a_cidade_de_hoje_como_resposta_provisoria(self):
        coordenada = {
            "latitude": Decimal("-25.3"),
            "longitude": Decimal("-54.1"),
        }
        corrigido = self.criar("a", **coordenada)
        ja_respondido = self.criar(
            "b",
            cidade_geocodificada="Foz do Iguaçu",
            estado_geocodificado="PR",
            **coordenada,
        )
        sem_coordenada = self.criar("c")

        copiar_e_geocodificar_de_novo(apps, None)

        for local in (corrigido, ja_respondido, sem_coordenada):
            local.refresh_from_db()
        self.assertEqual(
            (corrigido.cidade_geocodificada, corrigido.estado_geocodificado),
            ("Medianeira", "PR"),
        )
        self.assertEqual(ja_respondido.cidade_geocodificada, "Foz do Iguaçu")
        self.assertEqual(sem_coordenada.cidade_geocodificada, "")
