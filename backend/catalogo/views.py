from django.db.models import F
from django.utils import timezone
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

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


def _eventos():
    return Evento.objects.select_related("local").prefetch_related(
        "categorias", "imagens", "faixas_preco"
    )


class EventoListView(ListAPIView):
    """Eventos futuros ou em andamento, por data, hora e título."""

    serializer_class = EventoSerializer
    permission_classes = (AllowAny,)
    pagination_class = PaginacaoEventos

    def get_queryset(self):
        eventos = visiveis(_eventos(), timezone.now())
        eventos = aplicar_filtros(eventos, self.request.query_params)
        return eventos.order_by(
            "data_inicio", F("hora_inicio").asc(nulls_last=True), "titulo"
        )


class EventoDetalheView(RetrieveAPIView):
    """Detalhe de um evento (também removidos e já encerrados)."""

    queryset = _eventos()
    serializer_class = EventoDetalheSerializer
    permission_classes = (AllowAny,)
