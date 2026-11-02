from django.urls import path

from usuarios.views import (
    CadastroView,
    CsrfView,
    EntrarView,
    EuView,
    SairView,
)

urlpatterns = [
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/cadastro/", CadastroView.as_view(), name="auth-cadastro"),
    path("auth/entrar/", EntrarView.as_view(), name="auth-entrar"),
    path("auth/sair/", SairView.as_view(), name="auth-sair"),
    path("eu/", EuView.as_view(), name="eu"),
]
