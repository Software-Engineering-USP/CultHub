from datetime import timedelta

from django.db.models import Q
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
from notificacoes.models import Notificacao
from notificacoes.serializers import NotificacaoSerializer


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
    """Filtra lembretes por marcação ativa e evento vigente."""
    agora = timezone.now()
    hoje = timezone.localtime(agora).date()
    amanha = hoje + timedelta(days=1)
    evento_futuro = Q(evento__inicio__gt=agora) | Q(
        evento__inicio__isnull=True,
        evento__data_inicio__gte=hoje,
        evento__data_inicio__lte=amanha,
    )
    marcado = Q(evento__interesses__usuario=usuario) | Q(
        evento__presencas__usuario=usuario
    )
    return (
        Notificacao.objects.filter(
            usuario=usuario,
            evento__removido_em__isnull=True,
        )
        .filter(evento_futuro, marcado)
        .select_related("evento", "evento__local")
        .order_by("lida_em", "-criada_em")
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
        "Lista notificações do usuário e cria lembretes únicos para eventos "
        "salvos ou confirmados que começam nas próximas 24 horas. Eventos "
        "sem horário são considerados próximos quando acontecem hoje ou "
        "amanhã."
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
