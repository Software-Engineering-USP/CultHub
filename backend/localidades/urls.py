from django.urls import path

from localidades.views import EstadosView, MunicipiosView

urlpatterns = [
    path("estados/", EstadosView.as_view(), name="localidades-estados"),
    path(
        "municipios/",
        MunicipiosView.as_view(),
        name="localidades-municipios",
    ),
]
