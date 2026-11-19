import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from usuarios.serializers import (
    CadastroSerializer,
    EntrarSerializer,
    PerfilSerializer,
    RecuperarSenhaSerializer,
    RedefinirSenhaSerializer,
)

logger = logging.getLogger(__name__)


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


class RecuperarSenhaView(APIView):
    """Envia link de redefinição sem revelar se o e-mail tem cadastro."""

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "recuperacao_senha"

    @extend_schema(request=RecuperarSenhaSerializer, responses={200: None})
    def post(self, request):
        serializer = RecuperarSenhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario_model = get_user_model()
        usuario = usuario_model.objects.filter(
            email=serializer.validated_data["email"], is_active=True
        ).first()
        if usuario:
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            token = default_token_generator.make_token(usuario)
            url = (
                f"{settings.FRONTEND_URL.rstrip('/')}/redefinir-senha/"
                f"{uid}/{token}"
            )
            mensagem = (
                f"Olá, {usuario.nome}.\n\nUse este link para criar uma nova "
                f"senha:\n{url}\n\n"
                "Se você não pediu a redefinição, ignore este e-mail."
            )
            if settings.EMAIL_BACKEND.endswith(".dummy.EmailBackend"):
                logger.warning(
                    "EMAIL_BACKEND não configurado: o e-mail de "
                    "recuperação de senha foi descartado"
                )
            try:
                send_mail(
                    "Redefinição de senha | CultHub",
                    mensagem,
                    settings.DEFAULT_FROM_EMAIL,
                    [usuario.email],
                )
            except Exception:
                # A resposta é a mesma com ou sem envio (não revela se o
                # e-mail existe); a falha fica só no log.
                logger.exception("Falha ao enviar o e-mail de recuperação")
        return Response(
            {
                "detail": (
                    "Se o e-mail estiver cadastrado, enviaremos um link "
                    "de recuperação."
                )
            }
        )


class RedefinirSenhaView(APIView):
    """Valida o token e atualiza a senha.

    O token deixa de valer depois do uso.
    """

    permission_classes = (AllowAny,)

    @extend_schema(request=RedefinirSenhaSerializer, responses={200: None})
    def post(self, request):
        serializer = RedefinirSenhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario_model = get_user_model()
        try:
            uid = force_str(
                urlsafe_base64_decode(serializer.validated_data["uid"])
            )
            usuario = usuario_model.objects.get(pk=uid, is_active=True)
        except (
            TypeError,
            ValueError,
            OverflowError,
            usuario_model.DoesNotExist,
        ):
            usuario = None
        if usuario is None or not default_token_generator.check_token(
            usuario, serializer.validated_data["token"]
        ):
            return Response(
                {
                    "detail": (
                        "Este link de recuperação é inválido ou expirou."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.set_password(serializer.validated_data["senha"])
        usuario.save(update_fields=["password"])
        return Response({"detail": "Senha redefinida com sucesso."})


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
