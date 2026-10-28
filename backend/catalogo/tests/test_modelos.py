from datetime import UTC, date, datetime, time

from django.db import IntegrityError, transaction
from django.test import TestCase

from catalogo.models import Evento, Local, Provedor


class EventoInicioFimTest(TestCase):
    def test_inicio_calculado_no_fuso(self):
        e = Evento.objects.create(
            titulo="Show",
            data_inicio=date(2026, 11, 20),
            hora_inicio=time(21, 0),
        )
        self.assertEqual(e.inicio, datetime(2026, 11, 21, 0, 0, tzinfo=UTC))
        self.assertIsNone(e.fim)

    def test_sem_hora_inicio_nulo(self):
        e = Evento.objects.create(
            titulo="Feira", data_inicio=date(2026, 11, 20)
        )
        self.assertIsNone(e.inicio)

    def test_fim_com_data_e_hora(self):
        e = Evento.objects.create(
            titulo="Festival",
            data_inicio=date(2026, 11, 20),
            hora_inicio=time(21, 0),
            data_fim=date(2026, 11, 21),
            hora_fim=time(2, 0),
        )
        self.assertEqual(e.fim, datetime(2026, 11, 21, 5, 0, tzinfo=UTC))

    def test_fim_sem_hora_nulo(self):
        e = Evento.objects.create(
            titulo="Festival",
            data_inicio=date(2026, 11, 20),
            data_fim=date(2026, 11, 21),
        )
        self.assertIsNone(e.fim)

    def test_provedor_padrao_manual(self):
        local = Local.objects.create(nome="Teatro")
        e = Evento.objects.create(
            titulo="Peça", data_inicio=date(2026, 11, 20)
        )
        self.assertEqual(local.provedor, Provedor.MANUAL)
        self.assertEqual(e.provedor, "manual")


class UnicidadeExternaTest(TestCase):
    def test_mesmo_id_externo_mesmo_provedor_falha(self):
        Local.objects.create(
            nome="A", provedor=Provedor.TICKETMASTER, id_externo="v1"
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            Local.objects.create(
                nome="B", provedor=Provedor.TICKETMASTER, id_externo="v1"
            )

    def test_manuais_com_id_externo_vazio_nao_conflitam(self):
        for titulo in ("A", "B"):
            Evento.objects.create(
                titulo=titulo, data_inicio=date(2026, 11, 20)
            )
        self.assertEqual(Evento.objects.count(), 2)
