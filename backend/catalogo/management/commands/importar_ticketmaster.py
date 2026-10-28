from datetime import datetime, time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from catalogo.importacao import importar
from catalogo.models import Evento, Provedor
from catalogo.ticketmaster import ErroTicketmaster, buscar_todos


class Command(BaseCommand):
    help = "Importa os eventos futuros do Ticketmaster para o catálogo."

    def handle(self, *args, **opcoes):
        if not settings.TICKETMASTER_API_KEY:
            raise CommandError("TICKETMASTER_API_KEY não configurada")
        inicio = datetime.combine(
            timezone.localdate(),
            time.min,
            tzinfo=timezone.get_current_timezone(),
        )
        try:
            eventos = buscar_todos(inicio)
        except ErroTicketmaster as erro:
            raise CommandError(str(erro)) from None
        if (
            not eventos
            and Evento.objects.filter(
                provedor=Provedor.TICKETMASTER, removido_em__isnull=True
            ).exists()
        ):
            raise CommandError(
                "O Ticketmaster não retornou nenhum evento; nada foi "
                "alterado para não remover o catálogo inteiro."
            )
        resumo = importar(eventos, timezone.now())
        self.stdout.write(f"criados: {resumo.criados}")
        self.stdout.write(f"atualizados: {resumo.atualizados}")
        self.stdout.write(f"removidos: {resumo.removidos}")
        self.stdout.write(f"ignorados: {resumo.ignorados}")
        self.stdout.write(f"sem categoria: {len(resumo.sem_categoria)}")
        for titulo in resumo.sem_categoria:
            self.stdout.write(f"  - {titulo}")
        if resumo.com_erro:
            self.stdout.write(f"com erro: {len(resumo.com_erro)}")
            for item in resumo.com_erro:
                self.stdout.write(f"  - {item}")
