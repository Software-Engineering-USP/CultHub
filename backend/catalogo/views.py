from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from catalogo.models import CategoriaCultural
from catalogo.serializers import CategoriaSerializer


class CategoriaListView(ListAPIView):
    """Categorias culturais (chips de preferências e filtros)."""

    queryset = CategoriaCultural.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = (AllowAny,)
    pagination_class = None
