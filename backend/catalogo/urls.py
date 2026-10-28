from django.urls import path

from catalogo.views import (
    CategoriaListView,
    EventoDetalheView,
    EventoListView,
)

urlpatterns = [
    path("categorias/", CategoriaListView.as_view(), name="categorias"),
    path("eventos/", EventoListView.as_view(), name="eventos"),
    path(
        "eventos/<uuid:pk>/",
        EventoDetalheView.as_view(),
        name="evento-detalhe",
    ),
]
