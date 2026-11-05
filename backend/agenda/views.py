from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogo.models import Evento


@extend_schema(
    responses={
        200: OpenApiResponse(description="Marcação já existia."),
        201: OpenApiResponse(description="Marcação criada."),
        204: OpenApiResponse(description="Marcação removida (ou ausente)."),
        404: OpenApiResponse(description="Evento inexistente."),
        409: OpenApiResponse(description="Evento removido do catálogo."),
    }
)
class MarcacaoView(APIView):
    """Marca (POST) ou desmarca (DELETE) um evento para o usuário logado.

    Parametrizada por `modelo` (InteresseEmEvento ou PresencaEmEvento) e
    `chave` (nome do campo booleano devolvido no corpo).
    """

    modelo = None
    chave = None

    def post(self, request, pk):
        evento = get_object_or_404(Evento, pk=pk)
        marcacao = self.modelo.objects.filter(
            usuario=request.user, evento=evento
        )
        if evento.removido_em is not None and not marcacao.exists():
            return Response(
                {"detail": "Este evento foi removido do catálogo."},
                status=status.HTTP_409_CONFLICT,
            )
        _, criada = self.modelo.objects.get_or_create(
            usuario=request.user, evento=evento
        )
        return Response(
            {self.chave: True},
            status=status.HTTP_201_CREATED if criada else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        evento = get_object_or_404(Evento, pk=pk)
        self.modelo.objects.filter(
            usuario=request.user, evento=evento
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
