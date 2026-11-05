from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from agenda.consultas import anotar_marcacoes
from agenda.serializers import (
    EventoDaAgendaSerializer,
    PeriodoSerializer,
    QuandoSerializer,
)
from catalogo.filtros import DATA_FIM_EFETIVA, filtrar_terminados
from catalogo.models import Evento
from catalogo.paginacao import PaginacaoEventos
from catalogo.views import eventos_com_relacoes


@extend_schema(
    request=None,
    responses={
        200: OpenApiResponse(description="Marcação já existia."),
        201: OpenApiResponse(description="Marcação criada."),
        204: OpenApiResponse(description="Marcação removida (ou ausente)."),
        404: OpenApiResponse(description="Evento inexistente."),
        409: OpenApiResponse(description="Evento removido do catálogo."),
    },
)
class MarcacaoView(APIView):
    """Marca (POST) ou desmarca (DELETE) um evento para o usuário logado.

    Parametrizada por `modelo` (InteresseEmEvento ou PresencaEmEvento) e
    `chave` (nome do campo booleano devolvido no corpo).
    """

    modelo = None
    chave = None

    def post(self, request, pk):
        evento = get_object_or_404(Evento, pk=pk)
        marcacao = self.modelo.objects.filter(
            usuario=request.user, evento=evento
        )
        if evento.removido_em is not None and not marcacao.exists():
            return Response(
                {"detail": "Este evento foi removido do catálogo."},
                status=status.HTTP_409_CONFLICT,
            )
        _, criada = self.modelo.objects.get_or_create(
            usuario=request.user, evento=evento
        )
        return Response(
            {self.chave: True},
            status=status.HTTP_201_CREATED if criada else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        evento = get_object_or_404(Evento, pk=pk)
        self.modelo.objects.filter(
            usuario=request.user, evento=evento
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ListaDoUsuarioView(ListAPIView):
    """Base das listas do usuário logado (inclui eventos removidos)."""

    serializer_class = EventoDaAgendaSerializer
    pagination_class = PaginacaoEventos

    def eventos(self):
        return anotar_marcacoes(eventos_com_relacoes(), self.request.user)


@extend_schema(responses=EventoDaAgendaSerializer(many=True))
class SalvosView(ListaDoUsuarioView):
    """Eventos salvos, do salvo mais recente para o mais antigo."""

    def get_queryset(self):
        return (
            self.eventos()
            .filter(salvo_em__isnull=False)
            .order_by("-salvo_em", "id")
        )


@extend_schema(
    parameters=[
        OpenApiParameter(
            "quando",
            str,
            required=True,
            enum=["futuras", "passadas"],
            description="Presenças em eventos futuros/em andamento ou já "
            "encerrados.",
        )
    ],
    responses=EventoDaAgendaSerializer(many=True),
)
class PresencasView(ListaDoUsuarioView):
    """Eventos com presença marcada, futuros ou passados."""

    def get_queryset(self):
        serializer = QuandoSerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        passadas = serializer.validated_data["quando"] == "passadas"
        eventos = filtrar_terminados(
            self.eventos().filter(presenca_em__isnull=False),
            timezone.now(),
            terminados=passadas,
        )
        if passadas:
            return eventos.order_by(
                "-data_inicio",
                F("hora_inicio").desc(nulls_last=True),
                "titulo",
                "id",
            )
        return eventos.order_by(
            "data_inicio",
            F("hora_inicio").asc(nulls_last=True),
            "titulo",
            "id",
        )


@extend_schema(
    parameters=[
        OpenApiParameter(
            "de",
            OpenApiTypes.DATE,
            required=True,
            description="Início do período (AAAA-MM-DD).",
        ),
        OpenApiParameter(
            "ate",
            OpenApiTypes.DATE,
            required=True,
            description="Fim do período (AAAA-MM-DD), até 366 dias.",
        ),
    ],
    responses=EventoDaAgendaSerializer(many=True),
)
class AgendaView(ListaDoUsuarioView):
    """Salvos e presenças que cruzam o período, uma vez cada."""

    def get_queryset(self):
        serializer = PeriodoSerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        de = serializer.validated_data["de"]
        ate = serializer.validated_data["ate"]
        return (
            self.eventos()
            .filter(Q(salvo_em__isnull=False) | Q(presenca_em__isnull=False))
            .alias(data_fim_efetiva=DATA_FIM_EFETIVA)
            .filter(data_inicio__lte=ate, data_fim_efetiva__gte=de)
            .order_by(
                "data_inicio",
                F("hora_inicio").asc(nulls_last=True),
                "titulo",
                "id",
            )
        )
