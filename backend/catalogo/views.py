from django.db.models import Count, F
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from agenda.consultas import anotar_marcacoes
from catalogo.filtros import aplicar_filtros, visiveis
from catalogo.models import CategoriaCultural, Evento
from catalogo.paginacao import PaginacaoEventos
from catalogo.serializers import (
    CategoriaSerializer,
    EventoDetalheSerializer,
    EventoSerializer,
)


class CategoriaListView(ListAPIView):
    """Categorias culturais (chips de preferências e filtros)."""

    queryset = CategoriaCultural.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = (AllowAny,)
    pagination_class = None


def eventos_com_relacoes():
    return Evento.objects.select_related("local").prefetch_related(
        "categorias", "imagens", "faixas_preco"
    )


# Corpo do 400 da listagem: `{"categorias": ["Categoria inexistente: x."]}`.
ERRO_DE_FILTRO = {
    "type": "object",
    "additionalProperties": {
        "type": "array",
        "items": {"type": "string"},
    },
}


@extend_schema(
    responses={
        200: EventoSerializer(many=True),
        400: OpenApiResponse(
            response=ERRO_DE_FILTRO,
            description="Filtro inválido; mensagens por parâmetro.",
        ),
    },
    parameters=[
        OpenApiParameter(
            "q",
            str,
            description="Busca no título, descrição ou nome do local.",
        ),
        OpenApiParameter(
            "categorias",
            str,
            description="Códigos de categoria separados por vírgula (OU).",
        ),
        OpenApiParameter(
            "preco",
            str,
            description=(
                "Situações de preço separadas por vírgula (OU): gratuito, "
                "pago ou desconhecido (sem preço informado)."
            ),
        ),
        OpenApiParameter(
            "de",
            OpenApiTypes.DATE,
            description="Eventos que terminam desde esta data (AAAA-MM-DD).",
        ),
        OpenApiParameter(
            "ate",
            OpenApiTypes.DATE,
            description="Eventos que começam até esta data (AAAA-MM-DD).",
        ),
        OpenApiParameter(
            "lat",
            float,
            description="Latitude do ponto de busca (com lng e raio).",
        ),
        OpenApiParameter(
            "lng",
            float,
            description="Longitude do ponto de busca (com lat e raio).",
        ),
        OpenApiParameter(
            "raio",
            float,
            description="Raio da busca em km (com lat e lng).",
        ),
    ],
)
class EventoListView(ListAPIView):
    """Eventos futuros ou em andamento, por data, hora e título."""

    serializer_class = EventoSerializer
    permission_classes = (AllowAny,)
    pagination_class = PaginacaoEventos

    def get_queryset(self):
        eventos = anotar_marcacoes(eventos_com_relacoes(), self.request.user)
        eventos = visiveis(eventos, timezone.now())
        eventos = aplicar_filtros(eventos, self.request.query_params)
        return eventos.order_by(
            "data_inicio",
            F("hora_inicio").asc(nulls_last=True),
            "titulo",
            "id",
        )


class EventoDetalheView(RetrieveAPIView):
    """Detalhe de um evento (também removidos e já encerrados)."""

    serializer_class = EventoDetalheSerializer
    permission_classes = (AllowAny,)

    def get_queryset(self):
        return anotar_marcacoes(
            eventos_com_relacoes(), self.request.user
        ).annotate(total_presencas=Count("presencas", distinct=True))
