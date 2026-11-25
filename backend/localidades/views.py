from django.utils.cache import patch_cache_control
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from localidades.municipios import estados, municipios_da_uf

# A lista do IBGE só muda com uma nova versão do back.
VALIDADE = 24 * 60 * 60


def _resposta(dados):
    resposta = Response(dados)
    patch_cache_control(resposta, public=True, max_age=VALIDADE)
    return resposta


class EstadosView(APIView):
    """Os 27 estados (com o DF): sigla e nome, em ordem de sigla."""

    permission_classes = (AllowAny,)

    @extend_schema(
        responses=inline_serializer(
            "Estado",
            {
                "sigla": serializers.CharField(),
                "nome": serializers.CharField(),
            },
            many=True,
        )
    )
    def get(self, request):
        return _resposta(
            [{"sigla": uf, "nome": nome} for uf, nome in estados().items()]
        )


class MunicipiosView(APIView):
    """Nomes oficiais (IBGE) dos municípios de uma UF, em ordem alfabética."""

    permission_classes = (AllowAny,)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "uf",
                str,
                required=True,
                description="Sigla do estado (ex.: SP).",
            )
        ],
        responses={
            200: OpenApiResponse(
                response={"type": "array", "items": {"type": "string"}}
            ),
            400: OpenApiResponse(description="UF ausente ou inexistente."),
        },
    )
    def get(self, request):
        uf = request.query_params.get("uf", "").strip().upper()
        if uf not in estados():
            return Response(
                {"uf": ["Informe a sigla de um estado (ex.: SP)."]},
                status=400,
            )
        return _resposta(municipios_da_uf(uf))
