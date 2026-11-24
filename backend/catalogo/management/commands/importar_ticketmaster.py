from datetime import datetime, time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from catalogo.geocodificacao import (
    MAXIMO_ERROS_SEGUIDOS,
    ResumoGeocodificacao,
    completar_cidades,
    pendentes,
)
from catalogo.importacao import ErroImportacao, importar
from catalogo.models import Evento, Provedor
from catalogo.ticketmaster import ErroTicketmaster, buscar_todos
from notificacoes.servicos import notificar_eventos_novos

# Locais novos geocodificados dentro da transação da importação, por
# execução (cada um leva pouco mais de 1 s; ver `geocodificacao.INTERVALO`).
LIMITE_NA_TRANSACAO = 10


def _completar_cidades_novas(agora, anteriores):
    """Geocodificação dos locais novos, dentro da transação.

    Com o Photon fora (falha passageira antes), nem tenta. Os locais que
    já deram erro em `anteriores` não são consultados de novo. Se o
    servidor já parecia recusar tudo (erros seguidos), para no primeiro
    erro para não segurar a transação.
    """
    if anteriores.passageira:
        return ResumoGeocodificacao()
    maximo = 1 if anteriores.falha else MAXIMO_ERROS_SEGUIDOS
    return completar_cidades(
        agora,
        LIMITE_NA_TRANSACAO,
        ignorar=anteriores.com_erro,
        maximo_erros_seguidos=maximo,
    )


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
        # Locais que ficaram sem cidade em importações anteriores: fora da
        # transação, cada um gravado logo após a consulta, para não segurar
        # o banco durante as consultas ao Photon nem perder o que foi
        # descoberto se algo falhar depois.
        anteriores = completar_cidades(timezone.now())
        # Mesma transação: se os avisos falharem, a importação é desfeita e
        # a próxima execução cria os eventos (e os avisos) de novo. Só evento
        # criado gera aviso, então importar sem avisar perderia os avisos.
        # A cidade dos locais novos é descoberta antes dos avisos, que
        # filtram por ela, mas só de alguns, para a transação ser curta; os
        # outros (e todos, com o Photon fora) filtram só pela UF desta vez.
        try:
            with transaction.atomic():
                # Depois da geocodificação acima, que pode levar minutos.
                agora = timezone.now()
                resumo = importar(eventos, agora)
                novos = _completar_cidades_novas(agora, anteriores)
                notificacoes = notificar_eventos_novos(resumo.ids_criados)
        except ErroImportacao as erro:
            raise CommandError(str(erro)) from None
        self.stdout.write(f"criados: {resumo.criados}")
        self.stdout.write(f"atualizados: {resumo.atualizados}")
        self.stdout.write(f"removidos: {resumo.removidos}")
        self.stdout.write(f"ignorados: {resumo.ignorados}")
        self._escrever_geocodificacao(anteriores, novos)
        self.stdout.write(f"notificações de evento novo: {notificacoes}")
        self.stdout.write(f"sem categoria: {len(resumo.sem_categoria)}")
        for titulo in resumo.sem_categoria:
            self.stdout.write(f"  - {titulo}")
        if resumo.com_erro:
            self.stdout.write(f"com erro: {len(resumo.com_erro)}")
            for item in resumo.com_erro:
                self.stdout.write(f"  - {item}")
        if resumo.remocao_pulada:
            self.stdout.write(
                "remoção pulada: há item com erro e sem id; nenhum evento "
                "foi removido."
            )

    def _escrever_geocodificacao(self, anteriores, novos):
        self.stdout.write(
            "cidades descobertas: "
            f"{anteriores.descobertos + novos.descobertos} de "
            f"{anteriores.conferidos + novos.conferidos} locais conferidos"
        )
        if com_erro := len(anteriores.com_erro) + len(novos.com_erro):
            self.stdout.write(f"locais com erro no Photon: {com_erro}")
        if falha := anteriores.falha or novos.falha:
            self.stdout.write(f"geocodificação interrompida ({falha})")
        if restantes := pendentes().count():
            self.stdout.write(
                f"locais sem cidade para a próxima importação: {restantes}"
            )
