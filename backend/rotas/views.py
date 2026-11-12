import hashlib
import json
import logging
import threading

from django.core.cache import cache, caches
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogo.models import Evento
from rotas.osrm import ErroOSRM, calcular_rotas
from rotas.photon import (
    ErroPhoton,
    buscar_endereco_reverso,
    buscar_enderecos,
)

ERRO_UPSTREAM = {
    "detail": "Não foi possível consultar o serviço de endereços."
}
ERRO_ROTA = {"detail": "Não foi possível calcular a rota."}
LOCAL_SEM_COORDENADAS = {"detail": "O local deste evento não tem coordenadas."}
LOCAL_FORA_DO_MAPA = {
    "detail": "Não foi possível localizar o local deste evento no mapa."
}
VALIDADE_CACHE = 24 * 60 * 60
MODOS_DE_ROTA = ("carro", "a_pe")
MINIMO_TEXTO = 3
MAXIMO_TEXTO = 200

logger = logging.getLogger(__name__)
# Travas da rota por chave de cache (repartidas por hash): pedidos iguais
# ao mesmo tempo esperam o primeiro em vez de consultar o OSRM de novo.
_TRAVAS_DA_ROTA = tuple(threading.Lock() for _ in range(64))


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
        except ErroPhoton as erro:
            logger.warning("Photon falhou: %s", erro)
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
        except ErroPhoton as erro:
            logger.warning("Photon falhou: %s", erro)
            return Response(ERRO_UPSTREAM, status=502)
        return Response({"rotulo": rotulo})


def _rotas_do_cache(chave, calcular):
    """`get_or_set` no cache de rotas, com uma consulta só por chave.

    A trava vale dentro do processo, como o próprio cache em memória.
    """
    cache_de_rotas = caches["rotas"]
    ausente = object()
    rotas = cache_de_rotas.get(chave, ausente)
    if rotas is not ausente:
        return rotas
    with _TRAVAS_DA_ROTA[hash(chave) % len(_TRAVAS_DA_ROTA)]:
        return cache_de_rotas.get_or_set(
            chave, calcular, timeout=VALIDADE_CACHE
        )


class RotaEventoSerializer(serializers.Serializer):
    latitude = _latitude()
    longitude = _longitude()
    modo = serializers.ChoiceField(choices=MODOS_DE_ROTA)


@extend_schema(
    parameters=[
        *(
            OpenApiParameter(
                nome,
                float,
                required=True,
                description=f"{descricao} Ponto de partida (o pino).",
            )
            for nome, descricao in PARAMETROS_COORDENADA
        ),
        OpenApiParameter(
            "modo",
            str,
            required=True,
            enum=MODOS_DE_ROTA,
            description="Meio de transporte.",
        ),
    ],
    responses={
        200: OpenApiResponse(
            description=(
                "modo, destino (latitude e longitude do local) e até 3 "
                "rotas, cada uma com distancia_metros, duracao_segundos e "
                "geometria (GeoJSON LineString, em [longitude, latitude]). "
                "rotas vazia quando não há trajeto a partir desse ponto."
            )
        ),
        400: OpenApiResponse(description="Parâmetro inválido."),
        404: OpenApiResponse(description="Evento não encontrado."),
        422: OpenApiResponse(
            description=(
                "O local do evento não tem coordenadas ou não fica perto "
                "de nenhuma via."
            )
        ),
        502: OpenApiResponse(description="Falha no serviço de rotas."),
    },
)
class RotaEventoView(APIView):
    """Rota de carro ou a pé do ponto de partida até o local do evento."""

    permission_classes = (AllowAny,)

    def get(self, request, evento_id):
        evento = get_object_or_404(
            Evento.objects.select_related("local"), pk=evento_id
        )
        parametros = RotaEventoSerializer(data=request.query_params)
        parametros.is_valid(raise_exception=True)
        modo = parametros.validated_data["modo"]
        local = evento.local
        if local is None or local.latitude is None or local.longitude is None:
            return Response(LOCAL_SEM_COORDENADAS, status=422)

        origem = (
            round(parametros.validated_data["latitude"], 4),
            round(parametros.validated_data["longitude"], 4),
        )
        destino = (float(local.latitude), float(local.longitude))
        chave = (
            f"osrm:{modo}:{origem[0]:.4f}:{origem[1]:.4f}:"
            f"{destino[0]:.6f}:{destino[1]:.6f}"
        )
        try:
            rotas = _rotas_do_cache(
                chave, lambda: calcular_rotas(modo, origem, destino)
            )
        except ErroOSRM as erro:
            logger.warning("OSRM falhou: %s", erro)
            return Response(ERRO_ROTA, status=502)
        if rotas is None:
            return Response(LOCAL_FORA_DO_MAPA, status=422)
        return Response(
            {
                "modo": modo,
                "destino": {"latitude": destino[0], "longitude": destino[1]},
                "rotas": rotas,
            }
        )
