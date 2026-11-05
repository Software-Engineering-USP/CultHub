from django.urls import path

from agenda.models import InteresseEmEvento, PresencaEmEvento
from agenda.views import AgendaView, MarcacaoView, PresencasView, SalvosView

urlpatterns = [
    path(
        "eventos/<uuid:pk>/salvar/",
        MarcacaoView.as_view(modelo=InteresseEmEvento, chave="salvo"),
        name="evento-salvar",
    ),
    path(
        "eventos/<uuid:pk>/presenca/",
        MarcacaoView.as_view(modelo=PresencaEmEvento, chave="presenca"),
        name="evento-presenca",
    ),
    path("eu/salvos/", SalvosView.as_view(), name="eu-salvos"),
    path("eu/presencas/", PresencasView.as_view(), name="eu-presencas"),
    path("eu/agenda/", AgendaView.as_view(), name="eu-agenda"),
]
