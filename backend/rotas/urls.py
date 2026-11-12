from django.urls import path

from rotas.views import OrigemBuscaView, OrigemReversaView

urlpatterns = [
    path(
        "origem/busca/", OrigemBuscaView.as_view(), name="rotas-origem-busca"
    ),
    path(
        "origem/reversa/",
        OrigemReversaView.as_view(),
        name="rotas-origem-reversa",
    ),
]
