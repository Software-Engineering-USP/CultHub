from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.serializers import (
    CadastroSerializer,
    EntrarSerializer,
    PerfilSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Entrega o cookie `csrftoken`; chamar antes do primeiro POST."""

    permission_classes = (AllowAny,)

    @extend_schema(responses={204: None})
    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


# O DRF só exige CSRF de quem já está logado; cadastro e login precisam
# exigir explicitamente (evita login forçado por outro site).
@method_decorator(csrf_protect, name="dispatch")
class CadastroView(APIView):
    """Cria a conta e já deixa o usuário logado."""

    permission_classes = (AllowAny,)

    @extend_schema(
        request=CadastroSerializer, responses={201: PerfilSerializer}
    )
    def post(self, request):
        serializer = CadastroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        login(request, usuario)
        return Response(
            PerfilSerializer(usuario).data, status=status.HTTP_201_CREATED
        )


@method_decorator(csrf_protect, name="dispatch")
class EntrarView(APIView):
    """Login por e-mail e senha; `lembrar` mantém a sessão após fechar."""

    permission_classes = (AllowAny,)

    @extend_schema(request=EntrarSerializer, responses={200: PerfilSerializer})
    def post(self, request):
        serializer = EntrarSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]
        login(request, usuario)
        # Sempre define: um login anterior sem "lembrar" deixa expiry 0
        lembrar = serializer.validated_data["lembrar"]
        request.session.set_expiry(None if lembrar else 0)
        return Response(PerfilSerializer(usuario).data)


class SairView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EuView(RetrieveUpdateAPIView):
    """Perfil do usuário logado: ler e editar (PATCH)."""

    serializer_class = PerfilSerializer
    http_method_names = ("get", "patch", "options")

    def get_object(self):
        return self.request.user
