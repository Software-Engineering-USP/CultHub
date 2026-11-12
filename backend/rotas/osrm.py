import http.client
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from rotas.photon import USER_AGENT

TIMEOUT = 10
TENTATIVAS = 2
# Modo → (nome do setting com a URL base, perfil no caminho).
MODOS = {
    "carro": ("OSRM_CARRO_URL", "driving"),
    "a_pe": ("OSRM_A_PE_URL", "foot"),
}
# Códigos que o OSRM devolve com HTTP 400 quando não há rota.
SEM_ROTA = {"NoRoute", "NoSegment"}
PARAMETROS = {
    "overview": "full",
    "geometries": "geojson",
    "steps": "false",
    "alternatives": "true",
}


class ErroOSRM(Exception):
    """Erro controlado ao consultar o OSRM."""


class _FalhaPassageira(ErroOSRM):
    """Falha que vale tentar de novo (rede, tempo esgotado, HTTP 5xx)."""


def _corpo_sem_rota(erro):
    """Corpo de um HTTP 400 que diz "sem rota", ou None."""
    try:
        dados = json.loads(erro.read())
    except (OSError, ValueError, http.client.HTTPException):
        return None
    if isinstance(dados, dict) and dados.get("code") in SEM_ROTA:
        return dados
    return None


def _requisitar(url):
    try:
        requisicao = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT}
        )
    except ValueError:
        raise ErroOSRM("URL do OSRM inválida") from None
    try:
        with urllib.request.urlopen(requisicao, timeout=TIMEOUT) as resposta:
            return json.load(resposta)
    except urllib.error.HTTPError as erro:
        mensagem = f"OSRM respondeu HTTP {erro.code}"
        if erro.code >= 500:
            raise _FalhaPassageira(mensagem) from None
        if erro.code == 400:
            dados = _corpo_sem_rota(erro)
            if dados is not None:
                return dados
        raise ErroOSRM(mensagem) from None
    except urllib.error.URLError as erro:
        raise _FalhaPassageira(
            f"falha de rede ({type(erro.reason).__name__})"
        ) from None
    except TimeoutError:
        raise _FalhaPassageira("tempo esgotado") from None
    except (OSError, http.client.HTTPException) as erro:
        raise _FalhaPassageira(
            f"falha de transporte ({type(erro).__name__})"
        ) from None
    except ValueError:
        raise ErroOSRM("resposta inválida") from None


def _ponto(coordenada):
    latitude, longitude = coordenada
    return f"{longitude:.6f},{latitude:.6f}"


def _consultar(modo, origem, destino):
    """JSON da rota do OSRM; `origem`/`destino` são (latitude, longitude)."""
    nome, perfil = MODOS[modo]
    base = getattr(settings, nome).rstrip("/")
    url = (
        f"{base}/route/v1/{perfil}/{_ponto(origem)};{_ponto(destino)}"
        f"?{urllib.parse.urlencode(PARAMETROS)}"
    )
    for tentativa in range(1, TENTATIVAS + 1):
        try:
            dados = _requisitar(url)
            break
        except _FalhaPassageira as erro:
            if tentativa == TENTATIVAS:
                raise ErroOSRM(str(erro)) from None

    if not isinstance(dados, dict):
        raise ErroOSRM("resposta inválida")
    return dados
