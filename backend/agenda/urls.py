from django.urls import path

from agenda.models import InteresseEmEvento, PresencaEmEvento
from agenda.views import MarcacaoView

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
]
