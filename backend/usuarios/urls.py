from django.urls import path

from usuarios.views import (
    CadastroView,
    CsrfView,
    EntrarView,
    EuView,
    PerfilPublicoView,
    RecuperarSenhaView,
    RedefinirSenhaView,
    SairView,
)

urlpatterns = [
    path("auth/csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("auth/cadastro/", CadastroView.as_view(), name="auth-cadastro"),
    path("auth/entrar/", EntrarView.as_view(), name="auth-entrar"),
    path(
        "auth/recuperar-senha/",
        RecuperarSenhaView.as_view(),
        name="auth-recuperar-senha",
    ),
    path(
        "auth/redefinir-senha/",
        RedefinirSenhaView.as_view(),
        name="auth-redefinir-senha",
    ),
    path("auth/sair/", SairView.as_view(), name="auth-sair"),
    path("eu/", EuView.as_view(), name="eu"),
    path(
        "usuarios/<uuid:pk>/",
        PerfilPublicoView.as_view(),
        name="usuario-perfil",
    ),
]
