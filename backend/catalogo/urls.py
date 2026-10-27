from django.urls import path

from catalogo.views import CategoriaListView

urlpatterns = [
    path("categorias/", CategoriaListView.as_view(), name="categorias"),
]
