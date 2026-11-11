import http.client
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

USER_AGENT = (
    "CultHub/1.0 (MAC0332 USP; "
    "+https://github.com/Software-Engineering-USP/CultHub)"
)
TIMEOUT = 5
TENTATIVAS = 2
# Retângulo do Brasil (minLon,minLat,maxLon,maxLat).
BBOX_BRASIL = "-74,-34,-28.8,5.3"
LIMITE_PHOTON = 10
LIMITE_SUGESTOES = 5


class ErroPhoton(Exception):
    """Erro controlado ao consultar o Photon."""


class _FalhaPassageira(ErroPhoton):
    """Falha que vale tentar de novo (rede, tempo esgotado, HTTP 5xx)."""


def _requisitar(url):
    requisicao = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=TIMEOUT) as resposta:
            return json.load(resposta)
    except urllib.error.HTTPError as erro:
        mensagem = f"Photon respondeu HTTP {erro.code}"
        if erro.code >= 500:
            raise _FalhaPassageira(mensagem) from None
        raise ErroPhoton(mensagem) from None
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
        raise ErroPhoton("resposta inválida") from None


def _get_json(caminho, parametros):
    base = settings.PHOTON_URL.rstrip("/")
    url = f"{base}{caminho}?{urllib.parse.urlencode(parametros)}"
    for tentativa in range(1, TENTATIVAS + 1):
        try:
            dados = _requisitar(url)
            break
        except _FalhaPassageira as erro:
            if tentativa == TENTATIVAS:
                raise ErroPhoton(str(erro)) from None

    if not isinstance(dados, dict) or not isinstance(
        dados.get("features"), list
    ):
        raise ErroPhoton("resposta inválida")
    return dados


def montar_rotulo(propriedades):
    """Endereço legível a partir das `properties` de uma feature."""
    nome = propriedades.get("name")
    rua = propriedades.get("street")
    if rua:
        principal = rua
        if propriedades.get("housenumber"):
            principal = f"{rua}, {propriedades['housenumber']}"
        if nome and nome != rua:
            principal = f"{nome} – {principal}"
    else:
        principal = nome

    cidade = propriedades.get("city")
    partes = [
        principal,
        propriedades.get("district") or propriedades.get("locality"),
        cidade,
        None if cidade else propriedades.get("state"),
    ]
    rotulo = []
    for parte in partes:
        if parte and (not rotulo or rotulo[-1] != parte):
            rotulo.append(parte)
    return ", ".join(rotulo) or None


def _numero(valor):
    return isinstance(valor, (int, float)) and not isinstance(valor, bool)


def _converter(feature):
    """Feature do Photon → (rótulo, latitude, longitude), ou None."""
    if not isinstance(feature, dict):
        return None
    propriedades = feature.get("properties")
    geometria = feature.get("geometry")
    if not isinstance(propriedades, dict) or not isinstance(geometria, dict):
        return None
    coordenadas = geometria.get("coordinates")
    if (
        not isinstance(coordenadas, list)
        or len(coordenadas) < 2
        or not all(_numero(valor) for valor in coordenadas[:2])
    ):
        return None
    rotulo = montar_rotulo(propriedades)
    if rotulo is None:
        return None
    longitude, latitude = coordenadas[:2]
    return rotulo, latitude, longitude


def _do_brasil(feature):
    return (
        isinstance(feature, dict)
        and isinstance(feature.get("properties"), dict)
        and feature["properties"].get("countrycode") == "BR"
    )


def buscar_enderecos(texto, latitude=None, longitude=None):
    """Sugestões de endereço no Brasil para o autocomplete."""
    parametros = {"q": texto, "limit": LIMITE_PHOTON, "bbox": BBOX_BRASIL}
    if latitude is not None and longitude is not None:
        parametros["lat"] = latitude
        parametros["lon"] = longitude
    dados = _get_json("/api/", parametros)

    resultados = []
    vistos = set()
    for feature in dados["features"]:
        if not _do_brasil(feature):
            continue
        convertida = _converter(feature)
        if convertida is None or convertida[0] in vistos:
            continue
        rotulo, lat, lon = convertida
        vistos.add(rotulo)
        resultados.append(
            {"rotulo": rotulo, "latitude": lat, "longitude": lon}
        )
        if len(resultados) == LIMITE_SUGESTOES:
            break
    return resultados


def buscar_endereco_reverso(latitude, longitude):
    """Rótulo do endereço mais próximo da coordenada, ou None."""
    dados = _get_json(
        "/reverse", {"lat": latitude, "lon": longitude, "limit": 1}
    )
    if not dados["features"]:
        return None
    convertida = _converter(dados["features"][0])
    return convertida[0] if convertida else None
