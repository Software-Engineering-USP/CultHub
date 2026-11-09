import hashlib

from django.core.cache import cache
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from clima.servicos import ErroOpenMeteo, buscar_localidades, buscar_previsao


class BuscaLocalidadeSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=100, trim_whitespace=True)
    pais = serializers.RegexField(r"^[A-Za-z]{2}$", required=False)


class ConsultaPrevisaoSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    dias = serializers.IntegerField(min_value=1, max_value=16, default=1)


ERRO_UPSTREAM = {"detail": "Não foi possível consultar o serviço de clima."}


@extend_schema(
    parameters=[
        OpenApiParameter(
            "nome", str, required=True, description="Cidade ou região."
        ),
        OpenApiParameter(
            "pais",
            str,
            required=False,
            description="Código ISO de 2 letras, por exemplo BR.",
        ),
    ],
    responses={
        200: OpenApiResponse(description="Localidades correspondentes."),
        400: OpenApiResponse(description="Parâmetro inválido."),
        502: OpenApiResponse(description="Falha no serviço de clima."),
    },
)
class LocalidadeListView(APIView):
    """Busca localidades e suas coordenadas para usar na previsão."""

    permission_classes = (AllowAny,)

    def get(self, request):
        parametros = BuscaLocalidadeSerializer(data=request.query_params)
        parametros.is_valid(raise_exception=True)
        nome = parametros.validated_data["nome"]
        pais = parametros.validated_data.get("pais", "")
        busca = f"{nome.casefold()}:{pais.upper()}".encode()
        hash_busca = hashlib.sha256(busca).hexdigest()
        chave = f"openmeteo:localidades:{hash_busca}"
        try:
            dados = cache.get_or_set(
                chave,
                lambda: buscar_localidades(nome, pais),
                timeout=3600,
            )
        except ErroOpenMeteo:
            return Response(ERRO_UPSTREAM, status=502)
        return Response({"resultados": dados})


@extend_schema(
    parameters=[
        OpenApiParameter(
            "latitude",
            float,
            required=True,
            description="Latitude WGS84, entre -90 e 90.",
        ),
        OpenApiParameter(
            "longitude",
            float,
            required=True,
            description="Longitude WGS84, entre -180 e 180.",
        ),
        OpenApiParameter(
            "dias",
            int,
            required=False,
            description="Dias de previsão, entre 1 e 16 (padrão 1).",
        ),
    ],
    responses={
        200: OpenApiResponse(
            description="Condições atuais e previsão diária local."
        ),
        400: OpenApiResponse(description="Parâmetro inválido."),
        502: OpenApiResponse(description="Falha no serviço de clima."),
    },
)
class PrevisaoView(APIView):
    """Condições atuais e previsão diária para coordenadas WGS84."""

    permission_classes = (AllowAny,)

    def get(self, request):
        parametros = ConsultaPrevisaoSerializer(data=request.query_params)
        parametros.is_valid(raise_exception=True)
        latitude = parametros.validated_data["latitude"]
        longitude = parametros.validated_data["longitude"]
        dias = parametros.validated_data["dias"]
        chave = f"openmeteo:previsao:{latitude:.4f}:{longitude:.4f}:{dias}"
        try:
            dados = cache.get_or_set(
                chave,
                lambda: buscar_previsao(latitude, longitude, dias),
                timeout=900,
            )
        except ErroOpenMeteo:
            return Response(ERRO_UPSTREAM, status=502)
        return Response(dados)
