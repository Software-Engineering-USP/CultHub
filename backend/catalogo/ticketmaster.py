"""Cliente mínimo da Discovery API do Ticketmaster (só stdlib)."""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC

from django.conf import settings

URL = "https://app.ticketmaster.com/discovery/v2/events.json"
LIMITE_EVENTOS = 1000


class ErroTicketmaster(Exception):
    """Falha ao consultar o Ticketmaster (mensagem nunca traz a URL/chave)."""


def buscar_pagina(pagina, inicio):
    """Busca uma página de eventos a partir de `inicio` (datetime aware)."""
    parametros = {
        "apikey": settings.TICKETMASTER_API_KEY,
        "countryCode": settings.TICKETMASTER_PAIS,
        "size": 200,
        "page": pagina,
        "sort": "date,asc",
        "startDateTime": inicio.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    url = f"{URL}?{urllib.parse.urlencode(parametros)}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resposta:
            return json.load(resposta)
    except urllib.error.HTTPError as erro:
        raise ErroTicketmaster(
            f"Ticketmaster respondeu HTTP {erro.code}"
        ) from None
    except urllib.error.URLError as erro:
        raise ErroTicketmaster(
            f"falha de rede ({type(erro.reason).__name__})"
        ) from None
    except TimeoutError:
        raise ErroTicketmaster("tempo esgotado") from None
    except ValueError:
        raise ErroTicketmaster("resposta não é JSON válido") from None


def buscar_todos(inicio, buscar=None, pausa=0.25):
    """Junta os eventos de todas as páginas, com pausa entre chamadas."""
    if buscar is None:
        buscar = buscar_pagina
    eventos = []
    pagina = 0
    while True:
        dados = buscar(pagina, inicio)
        info = dados.get("page", {})
        if info.get("totalElements", 0) > LIMITE_EVENTOS:
            raise ErroTicketmaster(
                "mais de 1000 eventos; a importação precisa fatiar por datas"
            )
        eventos.extend(dados.get("_embedded", {}).get("events", []))
        if pagina >= info.get("totalPages", 0) - 1:
            return eventos
        pagina += 1
        time.sleep(pausa)
