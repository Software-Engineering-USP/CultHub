from django.urls import path

from clima.views import LocalidadeListView, PrevisaoView

urlpatterns = [
    path(
        "localidades/", LocalidadeListView.as_view(), name="clima-localidades"
    ),
    path("previsao/", PrevisaoView.as_view(), name="clima-previsao"),
]
