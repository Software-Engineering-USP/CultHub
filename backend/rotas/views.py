import hashlib
import json

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

from rotas.photon import (
    ErroPhoton,
    buscar_endereco_reverso,
    buscar_enderecos,
)

ERRO_UPSTREAM = {
    "detail": "Não foi possível consultar o serviço de endereços."
}
VALIDADE_CACHE = 24 * 60 * 60
MINIMO_TEXTO = 3
MAXIMO_TEXTO = 200


def _latitude(**kwargs):
    return serializers.FloatField(min_value=-90, max_value=90, **kwargs)


def _longitude(**kwargs):
    return serializers.FloatField(min_value=-180, max_value=180, **kwargs)


class BuscaEnderecoSerializer(serializers.Serializer):
    q = serializers.CharField()
    latitude = _latitude(required=False)
    longitude = _longitude(required=False)

    def validate_q(self, valor):
        texto = " ".join(valor.split())
        if not MINIMO_TEXTO <= len(texto) <= MAXIMO_TEXTO:
            raise serializers.ValidationError(
                f"Informe de {MINIMO_TEXTO} a {MAXIMO_TEXTO} caracteres."
            )
        return texto

    def validate(self, dados):
        if ("latitude" in dados) != ("longitude" in dados):
            raise serializers.ValidationError(
                "Informe latitude e longitude juntas, ou nenhuma das duas."
            )
        return dados


class CoordenadaSerializer(serializers.Serializer):
    latitude = _latitude()
    longitude = _longitude()


PARAMETROS_COORDENADA = [
    ("latitude", "Latitude WGS84, entre -90 e 90."),
    ("longitude", "Longitude WGS84, entre -180 e 180."),
]
RESPOSTAS_ERRO = {
    400: OpenApiResponse(description="Parâmetro inválido."),
    502: OpenApiResponse(description="Falha no serviço de endereços."),
}


@extend_schema(
    parameters=[
        OpenApiParameter(
            "q",
            str,
            required=True,
            description=(
                "Endereço digitado, de 3 a 200 caracteres (espaços "
                "repetidos contam como um)."
            ),
        ),
        *(
            OpenApiParameter(
                nome,
                float,
                required=False,
                description=(
                    f"{descricao} Opcional; vai junto com a outra "
                    "coordenada e puxa os resultados para perto dela "
                    "(ex.: o local do evento)."
                ),
            )
            for nome, descricao in PARAMETROS_COORDENADA
        ),
    ],
    responses={
        200: OpenApiResponse(
            description=(
                "Até 5 sugestões no Brasil: rotulo, latitude e longitude."
            )
        ),
        **RESPOSTAS_ERRO,
    },
)
class OrigemBuscaView(APIView):
    """Autocomplete do endereço de partida da rota."""

    permission_classes = (AllowAny,)

    def get(self, request):
        parametros = BuscaEnderecoSerializer(data=request.query_params)
        parametros.is_valid(raise_exception=True)
        texto = parametros.validated_data["q"]
        latitude = parametros.validated_data.get("latitude")
        longitude = parametros.validated_data.get("longitude")
        if latitude is not None:
            latitude = round(latitude, 2)
            longitude = round(longitude, 2)
        busca = json.dumps([texto.casefold(), latitude, longitude])
        chave = f"photon:busca:{hashlib.sha256(busca.encode()).hexdigest()}"
        try:
            resultados = cache.get_or_set(
                chave,
                lambda: buscar_enderecos(texto, latitude, longitude),
                timeout=VALIDADE_CACHE,
            )
        except ErroPhoton:
            return Response(ERRO_UPSTREAM, status=502)
        return Response({"resultados": resultados})


@extend_schema(
    parameters=[
        OpenApiParameter(nome, float, required=True, description=descricao)
        for nome, descricao in PARAMETROS_COORDENADA
    ],
    responses={
        200: OpenApiResponse(
            description=(
                "Endereço legível mais próximo em rotulo, ou null se não "
                "houver."
            )
        ),
        **RESPOSTAS_ERRO,
    },
)
class OrigemReversaView(APIView):
    """Endereço legível do ponto escolhido como partida."""

    permission_classes = (AllowAny,)

    def get(self, request):
        parametros = CoordenadaSerializer(data=request.query_params)
        parametros.is_valid(raise_exception=True)
        latitude = round(parametros.validated_data["latitude"], 4)
        longitude = round(parametros.validated_data["longitude"], 4)
        chave = f"photon:reversa:{latitude:.4f}:{longitude:.4f}"
        try:
            rotulo = cache.get_or_set(
                chave,
                lambda: buscar_endereco_reverso(latitude, longitude),
                timeout=VALIDADE_CACHE,
            )
        except ErroPhoton:
            return Response(ERRO_UPSTREAM, status=502)
        return Response({"rotulo": rotulo})
