import hashlib
import json
import logging
import math
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
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from catalogo.models import Evento
from rotas.osrm import MODOS, ErroOSRM, calcular_rotas
from rotas.osrm import PRAZO as PRAZO_OSRM
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
MODOS_DE_ROTA = tuple(MODOS)
# Distância máxima (km, em linha reta) da partida até o local, por modo:
# limita o tamanho da rota guardada no cache.
DISTANCIA_MAXIMA_KM = {"carro": 150, "a_pe": 30}
RAIO_DA_TERRA_KM = 6371.0088
MINIMO_TEXTO = 3
MAXIMO_TEXTO = 200

logger = logging.getLogger(__name__)


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
LIMITE_DE_PEDIDOS = OpenApiResponse(
    description="Pedidos demais deste usuário ou IP; tente mais tarde."
)
RESPOSTAS_ERRO = {
    400: OpenApiResponse(description="Parâmetro inválido."),
    429: LIMITE_DE_PEDIDOS,
    502: OpenApiResponse(description="Falha no serviço de endereços."),
}


class _PublicoComLimite(APIView):
    """Endpoint público com limite de pedidos (escopo em `throttle_scope`)."""

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)


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
class OrigemBuscaView(_PublicoComLimite):
    """Autocomplete do endereço de partida da rota."""

    throttle_scope = "endereco"

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
class OrigemReversaView(_PublicoComLimite):
    """Endereço legível do ponto escolhido como partida."""

    throttle_scope = "endereco"

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


class _ConsultaEmAndamento:
    """Consulta de rota em curso, que outros pedidos iguais aguardam."""

    def __init__(self):
        self.pronta = threading.Event()
        self.rotas = None
        # Mensagem do erro; continua preenchida se a consulta não terminar
        # bem por qualquer motivo.
        self.falha = "consulta igual falhou"


# Consultas em curso por chave de cache, dentro do processo (como o
# próprio cache em memória).
_EM_ANDAMENTO = {}
_TRAVA_EM_ANDAMENTO = threading.Lock()


def _aguardar(consulta):
    if not consulta.pronta.wait(PRAZO_OSRM):
        raise ErroOSRM("consulta igual ainda em andamento")
    if consulta.falha is not None:
        raise ErroOSRM(consulta.falha)
    return consulta.rotas


def _rotas_do_cache(chave, calcular):
    """`get_or_set` no cache de rotas, com uma consulta só por chave.

    Pedidos iguais ao mesmo tempo esperam a consulta em curso (até o prazo
    do OSRM) e ficam com o resultado ou a falha dela, sem consultar de
    novo. Chaves diferentes não esperam umas pelas outras.
    """
    cache_de_rotas = caches["rotas"]
    ausente = object()
    rotas = cache_de_rotas.get(chave, ausente)
    if rotas is not ausente:
        return rotas
    with _TRAVA_EM_ANDAMENTO:
        consulta = _EM_ANDAMENTO.get(chave)
        if consulta is None:
            consulta = _EM_ANDAMENTO[chave] = _ConsultaEmAndamento()
            dono = True
        else:
            dono = False
    if not dono:
        return _aguardar(consulta)
    try:
        # Outra consulta pode ter terminado entre o get e o registro.
        rotas = cache_de_rotas.get(chave, ausente)
        if rotas is ausente:
            rotas = calcular()
            cache_de_rotas.set(chave, rotas, timeout=VALIDADE_CACHE)
        consulta.rotas = rotas
        consulta.falha = None
        return rotas
    except ErroOSRM as erro:
        consulta.falha = str(erro)
        raise
    finally:
        with _TRAVA_EM_ANDAMENTO:
            del _EM_ANDAMENTO[chave]
        consulta.pronta.set()


def _distancia_km(ponto, outro):
    """Distância em linha reta (haversine) entre (latitude, longitude)."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*ponto, *outro))
    seno_lat = math.sin((lat2 - lat1) / 2)
    seno_lon = math.sin((lon2 - lon1) / 2)
    meio = seno_lat**2 + math.cos(lat1) * math.cos(lat2) * seno_lon**2
    return 2 * RAIO_DA_TERRA_KM * math.asin(math.sqrt(min(meio, 1)))


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
        400: OpenApiResponse(
            description=(
                "Parâmetro inválido, ou partida longe demais do local "
                "(mais de 150 km de carro ou 30 km a pé, em linha reta)."
            )
        ),
        404: OpenApiResponse(description="Evento não encontrado."),
        422: OpenApiResponse(
            description=(
                "O local do evento não tem coordenadas ou não fica perto "
                "de nenhuma via."
            )
        ),
        429: LIMITE_DE_PEDIDOS,
        502: OpenApiResponse(description="Falha no serviço de rotas."),
    },
)
class RotaEventoView(_PublicoComLimite):
    """Rota de carro ou a pé do ponto de partida até o local do evento."""

    throttle_scope = "rota"

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
        maximo = DISTANCIA_MAXIMA_KM[modo]
        if _distancia_km(origem, destino) > maximo:
            return Response(
                {
                    "detail": (
                        "Escolha um ponto de partida a até "
                        f"{maximo} km do local do evento."
                    )
                },
                status=400,
            )
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
