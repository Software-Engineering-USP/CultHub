import urllib.parse

from django.conf import settings

from rotas.transporte import RESPOSTA_INVALIDA, numero, obter_json

TIMEOUT = 5
TENTATIVAS = 2
# Retângulo do Brasil (minLon,minLat,maxLon,maxLat).
BBOX_BRASIL = "-74,-34,-28.8,5.3"
LIMITE_PHOTON = 10
LIMITE_SUGESTOES = 5


class ErroPhoton(Exception):
    """Erro controlado ao consultar o Photon.

    `passageira` diz se é falha do servidor ou da rede (ver
    `rotas.transporte.obter_json`), e não daquele pedido.
    """

    passageira = False


def _get_json(caminho, parametros):
    base = settings.PHOTON_URL.rstrip("/")
    dados = obter_json(
        f"{base}{caminho}?{urllib.parse.urlencode(parametros)}",
        servico="Photon",
        erro=ErroPhoton,
        timeout=TIMEOUT,
        tentativas=TENTATIVAS,
    )
    if not isinstance(dados, dict) or not isinstance(
        dados.get("features"), list
    ):
        raise ErroPhoton(RESPOSTA_INVALIDA)
    return dados


def _texto(propriedades, chave):
    valor = propriedades.get(chave)
    return valor if isinstance(valor, str) and valor else None


def _principal(propriedades):
    """Nome e/ou rua com o número da casa, quando houver."""
    nome = _texto(propriedades, "name")
    rua = _texto(propriedades, "street")
    numero = _texto(propriedades, "housenumber")
    endereco = rua or nome
    if endereco and numero:
        endereco = f"{endereco}, {numero}"
    if rua and nome and nome != rua:
        return f"{nome} – {endereco}"
    return endereco


def montar_rotulo(propriedades):
    """Endereço legível a partir das `properties` de uma feature."""
    cidade = _texto(propriedades, "city")
    partes = [
        _principal(propriedades),
        _texto(propriedades, "district") or _texto(propriedades, "locality"),
        cidade,
        None if cidade else _texto(propriedades, "state"),
    ]
    rotulo = []
    for parte in partes:
        if parte and (not rotulo or rotulo[-1] != parte):
            rotulo.append(parte)
    return ", ".join(rotulo) or None


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
        or not all(numero(valor) for valor in coordenadas[:2])
    ):
        return None
    longitude, latitude = coordenadas[:2]
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    rotulo = montar_rotulo(propriedades)
    if rotulo is None:
        return None
    return rotulo, latitude, longitude


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
        convertida = _converter(feature)
        if convertida is None:
            continue
        rotulo, lat, lon = convertida
        # _converter já garantiu que feature["properties"] é um dict.
        if feature["properties"].get("countrycode") != "BR":
            continue
        if rotulo in vistos:
            continue
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


def buscar_cidade_e_estado(latitude, longitude):
    """(cidade, estado) do ponto, como o Photon escreve; None fora do BR.

    O estado às vezes vem pelo nome ("São Paulo"), às vezes pela sigla
    ("SP"); qualquer um dos dois pode faltar e vir como "".
    """
    dados = _get_json(
        "/reverse", {"lat": latitude, "lon": longitude, "limit": 1}
    )
    if not dados["features"] or not isinstance(dados["features"][0], dict):
        return None
    propriedades = dados["features"][0].get("properties")
    if (
        not isinstance(propriedades, dict)
        or propriedades.get("countrycode") != "BR"
    ):
        return None
    return (
        _texto(propriedades, "city") or "",
        _texto(propriedades, "state") or "",
    )
