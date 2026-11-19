from datetime import timedelta

from django.db.models import (
    BooleanField,
    Exists,
    ExpressionWrapper,
    OuterRef,
    Q,
)
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogo.models import Evento
from notificacoes.models import Notificacao, TipoNotificacao
from notificacoes.serializers import NotificacaoSerializer

# Por quanto tempo um aviso de evento novo continua na lista.
DIAS_DE_EVENTO_NOVO = 7


def _criar_lembretes_proximos(usuario):
    """Gera lembretes únicos para eventos salvos ou confirmados próximos."""
    agora = timezone.now()
    limite = agora + timedelta(hours=24)
    hoje = timezone.localtime(agora).date()
    amanha = hoje + timedelta(days=1)
    inicio_proximo = Q(inicio__gt=agora, inicio__lte=limite) | Q(
        inicio__isnull=True,
        data_inicio__gte=hoje,
        data_inicio__lte=amanha,
    )
    eventos = (
        Evento.objects.filter(
            Q(interesses__usuario=usuario) | Q(presencas__usuario=usuario),
            removido_em__isnull=True,
        )
        .filter(inicio_proximo)
        .only("id")
        .distinct()
    )
    Notificacao.objects.bulk_create(
        [
            Notificacao(usuario=usuario, evento_id=evento.pk)
            for evento in eventos
        ],
        ignore_conflicts=True,
    )


def _notificacoes_ativas(usuario):
    """Notificações que ainda fazem sentido mostrar, não lidas primeiro.

    Lembrete vale enquanto o evento continua marcado e não começou. Aviso
    de evento novo vale por `DIAS_DE_EVENTO_NOVO` dias, e só até o evento
    começar ou ganhar um lembrete (que o substitui de vez).
    """
    agora = timezone.now()
    hoje = timezone.localtime(agora).date()
    amanha = hoje + timedelta(days=1)
    lembrete_vigente = (
        Q(tipo=TipoNotificacao.LEMBRETE)
        & (
            Q(evento__inicio__gt=agora)
            | Q(
                evento__inicio__isnull=True,
                evento__data_inicio__gte=hoje,
                evento__data_inicio__lte=amanha,
            )
        )
        & (
            Q(evento__interesses__usuario=usuario)
            | Q(evento__presencas__usuario=usuario)
        )
    )
    # Evento que já teve lembrete não aparece duas vezes: o lembrete
    # substitui de vez o aviso de evento novo, mesmo depois de o usuário
    # desmarcar o evento.
    tem_lembrete = Exists(
        Notificacao.objects.filter(
            usuario=usuario,
            evento=OuterRef("evento"),
            tipo=TipoNotificacao.LEMBRETE,
        )
    )
    evento_novo_vigente = (
        Q(tipo=TipoNotificacao.EVENTO_NOVO)
        & ~tem_lembrete
        & Q(criada_em__gte=agora - timedelta(days=DIAS_DE_EVENTO_NOVO))
        & (
            Q(evento__inicio__gt=agora)
            | Q(evento__inicio__isnull=True, evento__data_inicio__gte=hoje)
        )
    )
    return (
        Notificacao.objects.filter(
            usuario=usuario,
            evento__removido_em__isnull=True,
        )
        .filter(lembrete_vigente | evento_novo_vigente)
        .select_related("evento", "evento__local")
        # Booleano em vez de ordenar por `lida_em`: o lugar do nulo muda
        # entre SQLite e Postgres.
        .annotate(
            lida=ExpressionWrapper(
                Q(lida_em__isnull=False), output_field=BooleanField()
            )
        )
        .order_by("lida", "-criada_em", "id")
        .distinct()
    )


@extend_schema(
    responses={
        200: inline_serializer(
            "ListaNotificacoes",
            {
                "nao_lidas": serializers.IntegerField(),
                "resultados": NotificacaoSerializer(many=True),
            },
        ),
    },
    description=(
        "Lista notificações do usuário, não lidas primeiro. `tipo` é "
        "`lembrete` (evento salvo ou confirmado que começa nas próximas 24 "
        "horas; sem horário, hoje ou amanhã) ou `evento_novo` (evento que "
        "entrou no catálogo e combina com as preferências e a cidade do "
        f"perfil; fica na lista por {DIAS_DE_EVENTO_NOVO} dias). Os "
        "lembretes são criados nesta chamada."
    ),
)
class NotificacoesView(ListAPIView):
    serializer_class = NotificacaoSerializer

    def get_queryset(self):
        _criar_lembretes_proximos(self.request.user)
        return _notificacoes_ativas(self.request.user)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data = {
            "nao_lidas": _notificacoes_ativas(request.user)
            .filter(lida_em__isnull=True)
            .count(),
            "resultados": response.data,
        }
        return response


@extend_schema(
    request=None,
    responses={
        204: OpenApiResponse(description="Notificação marcada como lida."),
        404: OpenApiResponse(description="Notificação não encontrada."),
    },
)
class MarcarNotificacaoLidaView(APIView):
    def patch(self, request, pk):
        atualizada = Notificacao.objects.filter(
            pk=pk, usuario=request.user, lida_em__isnull=True
        ).update(lida_em=timezone.now())
        if atualizada:
            return Response(status=status.HTTP_204_NO_CONTENT)
        existe = Notificacao.objects.filter(
            pk=pk, usuario=request.user
        ).exists()
        if existe:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)


@extend_schema(
    request=None,
    responses={
        204: OpenApiResponse(description="Notificações marcadas como lidas.")
    },
)
class MarcarTodasLidasView(APIView):
    def post(self, request):
        Notificacao.objects.filter(
            usuario=request.user, lida_em__isnull=True
        ).update(lida_em=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)
