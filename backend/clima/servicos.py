import http.client
import json
import urllib.error
import urllib.parse
import urllib.request


class ErroOpenMeteo(Exception):
    """Erro controlado ao consultar o Open-Meteo."""

def _get_json(base_url, parametros):
    url = f"{base_url}?{urllib.parse.urlencode(parametros)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resposta:
            dados = json.load(resposta)
    except urllib.error.HTTPError as erro:
        raise ErroOpenMeteo(f"Open-Meteo respondeu HTTP {erro.code}") from None
    except urllib.error.URLError as erro:
        raise ErroOpenMeteo(
            f"falha de rede ({type(erro.reason).__name__})"
        ) from None
    except TimeoutError:
        raise ErroOpenMeteo("tempo esgotado") from None
    except (OSError, http.client.HTTPException) as erro:
        raise ErroOpenMeteo(
            f"falha de transporte ({type(erro).__name__})"
        ) from None
    except (ValueError, json.JSONDecodeError):
        raise ErroOpenMeteo("resposta inválida") from None

    if not isinstance(dados, dict) or dados.get("error"):
        raise ErroOpenMeteo("resposta inválida")
    return dados

def buscar_localidades(nome, pais=None):
    parametros = {"name": nome, "count": 10, "language": "pt"}
    if pais:
        parametros["countryCode"] = pais.upper()
    dados = _get_json(
        "https://geocoding-api.open-meteo.com/v1/search", parametros
    )
    return dados.get("results", [])

def buscar_previsao(latitude, longitude, dias=1):
    parametros = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,relative_humidity_2m,apparent_temperature,"
            "is_day,precipitation,weather_code,wind_speed_10m"
        ),
        "daily": (
            "weather_code,temperature_2m_max,temperature_2m_min,"
            "precipitation_probability_max"
        ),
        "forecast_days": dias,
        "timezone": "auto",
    }
    return _get_json("https://api.open-meteo.com/v1/forecast", parametros)
