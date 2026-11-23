from django.db.models import Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from catalogo.models import Evento
from catalogo.paginacao import PaginacaoEventos
from comentarios.models import Comentario, profundidade_maxima
from comentarios.serializers import (
    ComentarioSerializer,
    MeuComentarioSerializer,
    TextoSerializer,
)

EVENTO_REMOVIDO = {"detail": "Este evento foi removido do catálogo."}
SO_O_AUTOR = "Só quem escreveu o comentário pode alterá-lo."

_RESPOSTA_409 = OpenApiResponse(
    description="Evento removido do catálogo (`detail` com a mensagem)."
)


def respostas_prefetch():
    """Prefetch das respostas, das mais antigas para as mais novas.

    Vai um nível além do limite: o serializer também olha as respostas do
    último nível (sempre vazias), e sem isso seria uma consulta por resposta.
    """
    caminho = []
    prefetches = []
    for _ in range(profundidade_maxima() + 1):
        caminho.append("respostas")
        prefetches.append(
            Prefetch(
                "__".join(caminho),
                queryset=Comentario.objects.select_related("autor").order_by(
                    "criado_em", "id"
                ),
            )
        )
    return prefetches


def com_algo_visivel():
    """Não removido, ou com alguma resposta não removida em qualquer nível.

    Filtra no banco quem aparece na lista, para a paginação não precisar
    carregar todos os comentários do evento.
    """
    condicao = Q(removido_em__isnull=True)
    for nivel in range(1, profundidade_maxima() + 1):
        ancestral = "__".join(["resposta_a"] * nivel)
        condicao |= Exists(
            Comentario.objects.filter(
                **{ancestral: OuterRef("pk")}, removido_em__isnull=True
            )
        )
    return condicao


class EscritaComLimite:
    """Limita só a escrita (escopo `comentario`); ler a lista é livre."""

    throttle_scope = "comentario"

    def get_throttles(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return []
        return [ScopedRateThrottle()]


def texto_enviado(request):
    """Texto do corpo, validado (400 com a mensagem por campo)."""
    dados = TextoSerializer(data=request.data)
    dados.is_valid(raise_exception=True)
    return dados.validated_data["texto"]


def comentario_em_json(request, comentario, codigo=status.HTTP_200_OK):
    return Response(
        ComentarioSerializer(comentario, context={"request": request}).data,
        status=codigo,
    )


def conflito(evento):
    """409 se o evento foi removido do catálogo; senão, None."""
    if evento.removido_em is not None:
        return Response(EVENTO_REMOVIDO, status=status.HTTP_409_CONFLICT)
    return None


def trocar_texto(comentario, texto, **marcas):
    """Grava um novo texto com as marcas de data (`editado_em`...)."""
    comentario.texto = texto
    for campo, valor in marcas.items():
        setattr(comentario, campo, valor)
    comentario.save(update_fields=("texto", *marcas))


def criar(request, evento, resposta_a=None):
    comentario = Comentario.objects.create(
        evento=evento,
        autor=request.user,
        resposta_a=resposta_a,
        texto=texto_enviado(request),
    )
    return comentario_em_json(request, comentario, status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(
        description=(
            "Comentários do evento, do mais recente para o mais antigo, com "
            "as respostas aninhadas (das mais antigas para as mais novas). "
            "Removidos só aparecem, sem texto, enquanto têm respostas."
        )
    )
)
class ComentariosDoEventoView(EscritaComLimite, ListAPIView):
    """Lista (GET, público) e cria (POST) os comentários de um evento."""

    serializer_class = ComentarioSerializer
    pagination_class = PaginacaoEventos

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def evento(self):
        return get_object_or_404(Evento, pk=self.kwargs["pk"])

    def get_queryset(self):
        return (
            Comentario.objects.filter(
                evento=self.evento(), resposta_a__isnull=True
            )
            .filter(com_algo_visivel())
            .select_related("autor")
            .prefetch_related(*respostas_prefetch())
            .order_by("-criado_em", "id")
        )

    @extend_schema(
        request=TextoSerializer,
        responses={201: ComentarioSerializer, 409: _RESPOSTA_409},
    )
    def post(self, request, pk):
        evento = self.evento()
        return conflito(evento) or criar(request, evento)


class RespostasView(EscritaComLimite, APIView):
    """Responde a um comentário (respeitando a profundidade máxima)."""

    @extend_schema(
        request=TextoSerializer,
        responses={201: ComentarioSerializer, 409: _RESPOSTA_409},
    )
    def post(self, request, pk):
        alvo = get_object_or_404(
            Comentario.objects.select_related("evento"), pk=pk
        )
        # Comentário removido também recebe resposta, direto ou por uma
        # resposta dele: a conversa segue embaixo do aviso "removido".
        return conflito(alvo.evento) or criar(
            request, alvo.evento, resposta_a=alvo
        )


class ComentarioView(EscritaComLimite, APIView):
    """Edita (PATCH) ou remove (DELETE) um comentário do próprio autor."""

    def comentario_do_autor(self, request, pk):
        comentario = get_object_or_404(
            Comentario.objects.filter(removido_em__isnull=True), pk=pk
        )
        if comentario.autor_id != request.user.pk:
            raise PermissionDenied(SO_O_AUTOR)
        return comentario

    @extend_schema(
        request=TextoSerializer,
        responses={200: ComentarioSerializer},
        description="Troca o texto e marca `editado_em`.",
    )
    def patch(self, request, pk):
        comentario = self.comentario_do_autor(request, pk)
        trocar_texto(
            comentario, texto_enviado(request), editado_em=timezone.now()
        )
        return comentario_em_json(request, comentario)

    @extend_schema(
        request=None,
        responses={204: OpenApiResponse(description="Comentário removido.")},
        description=(
            "Remove o texto, mas mantém as respostas: o comentário passa a "
            "aparecer como removido enquanto tiver respostas."
        ),
    )
    def delete(self, request, pk):
        comentario = self.comentario_do_autor(request, pk)
        trocar_texto(comentario, "", removido_em=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(responses=MeuComentarioSerializer(many=True))
class MeusComentariosView(ListAPIView):
    """Comentários e respostas do usuário logado, do mais recente."""

    serializer_class = MeuComentarioSerializer
    pagination_class = PaginacaoEventos

    def get_queryset(self):
        return (
            Comentario.objects.filter(
                autor=self.request.user, removido_em__isnull=True
            )
            .select_related("evento")
            .order_by("-criado_em", "id")
        )
