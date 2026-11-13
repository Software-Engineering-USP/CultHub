import http.client
import json
import math
import re
import urllib.parse

from django.conf import settings

from rotas.transporte import (
    RESPOSTA_INVALIDA,
    Espacador,
    numero,
    obter_json,
)

TIMEOUT = 10
TENTATIVAS = 2
# Tempo total de uma consulta, somando a espera da vez e as tentativas:
# depois de um tempo esgotado (10 s) não sobra prazo para repetir.
PRAZO = 12
# Política do routing.openstreetmap.de: no máximo 1 requisição por segundo.
INTERVALO_ENTRE_REQUISICOES = 1
# Fila maior que isso dá erro na hora, sem chamar o OSRM.
ESPERA_MAXIMA = 4
# Distância máxima entre o ponto pedido e a via onde o OSRM o encaixou.
LIMITE_ENCAIXE_METROS = 1000
MAXIMO_ROTAS = 3
# Modo → (nome do setting com a URL base, perfil no caminho).
MODOS = {
    "carro": ("OSRM_CARRO_URL", "driving"),
    "a_pe": ("OSRM_A_PE_URL", "foot"),
}
# Códigos que o OSRM devolve com HTTP 400 quando não há rota.
SEM_ROTA = {"NoRoute", "NoSegment"}
# O NoSegment diz o índice do ponto que não encaixa em via nenhuma
# ("... for coordinate 1" no OSRM 5.27); o destino é o 2º ponto.
INDICE_DO_PONTO = re.compile(r"\bcoordinate\s+(\d+)\b")
INDICE_DO_DESTINO = 1
PARAMETROS = {
    "overview": "full",
    "geometries": "geojson",
    "steps": "false",
    # "true" pede só 1 alternativa; um número pede até esse tanto.
    "alternatives": str(MAXIMO_ROTAS - 1),
}

_vez = Espacador(INTERVALO_ENTRE_REQUISICOES, ESPERA_MAXIMA)


class ErroOSRM(Exception):
    """Erro controlado ao consultar o OSRM."""


def _codigo(dados):
    """Campo `code` da resposta, só se for texto."""
    codigo = dados.get("code")
    return codigo if isinstance(codigo, str) else None


def _corpo_sem_rota(erro):
    """Corpo de um HTTP 400 que diz "sem rota", ou None."""
    if erro.code != 400:
        return None
    try:
        dados = json.loads(erro.read())
    except (OSError, ValueError, http.client.HTTPException):
        return None
    if isinstance(dados, dict) and _codigo(dados) in SEM_ROTA:
        return dados
    return None


def _esperar_vez():
    if not _vez.aguardar():
        raise ErroOSRM("muitas requisições na fila")


def _ponto(coordenada):
    latitude, longitude = coordenada
    return f"{longitude:.6f},{latitude:.6f}"


def _consultar(modo, origem, destino):
    """JSON da rota do OSRM; `origem`/`destino` são (latitude, longitude)."""
    nome, perfil = MODOS[modo]
    base = getattr(settings, nome).rstrip("/")
    dados = obter_json(
        f"{base}/route/v1/{perfil}/{_ponto(origem)};{_ponto(destino)}"
        f"?{urllib.parse.urlencode(PARAMETROS)}",
        servico="OSRM",
        erro=ErroOSRM,
        timeout=TIMEOUT,
        tentativas=TENTATIVAS,
        prazo=PRAZO,
        antes_de_tentar=_esperar_vez,
        ler_erro_http=_corpo_sem_rota,
    )
    if not isinstance(dados, dict):
        raise ErroOSRM(RESPOSTA_INVALIDA)
    return dados


def _arredondar(valor):
    """Inteiro mais próximo, com meio para cima (772,5 → 773)."""
    return math.floor(valor + 0.5)


def _encaixes(dados):
    """Distâncias (m) da origem e do destino até a via usada pelo OSRM."""
    pontos = dados.get("waypoints")
    if not isinstance(pontos, list) or len(pontos) < 2:
        raise ErroOSRM(RESPOSTA_INVALIDA)
    distancias = [
        ponto.get("distance") if isinstance(ponto, dict) else None
        for ponto in pontos[:2]
    ]
    if not all(numero(distancia) for distancia in distancias):
        raise ErroOSRM(RESPOSTA_INVALIDA)
    return distancias


def _posicao_valida(posicao):
    """Par [longitude, latitude] de números dentro dos limites."""
    return (
        isinstance(posicao, list)
        and len(posicao) == 2
        and all(numero(valor) for valor in posicao)
        and -180 <= posicao[0] <= 180
        and -90 <= posicao[1] <= 90
    )


def _geometria_valida(geometria):
    """LineString GeoJSON com 2 ou mais posições válidas."""
    if not isinstance(geometria, dict):
        return False
    posicoes = geometria.get("coordinates")
    return (
        geometria.get("type") == "LineString"
        and isinstance(posicoes, list)
        and len(posicoes) >= 2
        and all(map(_posicao_valida, posicoes))
    )


def _converter_rota(rota):
    """Rota do OSRM → formato do CultHub, ou None se estiver malformada."""
    if not isinstance(rota, dict):
        return None
    distancia = rota.get("distance")
    duracao = rota.get("duration")
    if not all(numero(v) and v >= 0 for v in (distancia, duracao)):
        return None
    geometria = rota.get("geometry")
    if not _geometria_valida(geometria):
        return None
    return {
        "distancia_metros": _arredondar(distancia),
        "duracao_segundos": _arredondar(duracao),
        # Só os campos validados: chave extra (ex.: bbox com NaN) não
        # passa adiante.
        "geometria": {
            "type": "LineString",
            "coordinates": geometria["coordinates"],
        },
    }


def _destino_sem_via(dados):
    """Se o NoSegment é do destino (e não da origem)."""
    mensagem = dados.get("message")
    if _codigo(dados) != "NoSegment" or not isinstance(mensagem, str):
        return False
    indice = INDICE_DO_PONTO.search(mensagem)
    return indice is not None and int(indice[1]) == INDICE_DO_DESTINO


def calcular_rotas(modo, origem, destino):
    """Até 3 rotas de `origem` a `destino`, ambos (latitude, longitude).

    Devolve `[]` quando não há rota (inclusive com a origem longe de
    qualquer via: mover o pino resolve) e `None` quando o destino está longe
    de qualquer via ou não encaixa em nenhuma (a coordenada do local está
    errada). Um `NoRoute` não diz qual ponto está isolado; vira `[]`.
    Levanta `ErroOSRM` em falha do servidor ou resposta inválida.
    """
    dados = _consultar(modo, origem, destino)
    codigo = _codigo(dados)
    if codigo in SEM_ROTA:
        return None if _destino_sem_via(dados) else []
    if codigo != "Ok":
        raise ErroOSRM(RESPOSTA_INVALIDA)

    encaixe_origem, encaixe_destino = _encaixes(dados)
    if encaixe_destino > LIMITE_ENCAIXE_METROS:
        return None
    if encaixe_origem > LIMITE_ENCAIXE_METROS:
        return []

    rotas = dados.get("routes")
    if not isinstance(rotas, list):
        raise ErroOSRM(RESPOSTA_INVALIDA)
    convertidas = [
        convertida
        for convertida in map(_converter_rota, rotas)
        if convertida is not None
    ]
    if not convertidas:
        raise ErroOSRM(RESPOSTA_INVALIDA)
    return convertidas[:MAXIMO_ROTAS]
