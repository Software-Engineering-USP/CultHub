from django.urls import path

from notificacoes.views import (
    MarcarNotificacaoLidaView,
    MarcarTodasLidasView,
    NotificacoesView,
)

urlpatterns = [
    path(
        "eu/notificacoes/",
        NotificacoesView.as_view(),
        name="eu-notificacoes",
    ),
    path(
        "notificacoes/<uuid:pk>/ler/",
        MarcarNotificacaoLidaView.as_view(),
        name="notificacao-ler",
    ),
    path(
        "eu/notificacoes/ler-todas/",
        MarcarTodasLidasView.as_view(),
        name="eu-notificacoes-ler-todas",
    ),
]
