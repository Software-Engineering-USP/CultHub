"""Cliente mínimo da Discovery API do Ticketmaster (só stdlib)."""

import http.client
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
    except (OSError, http.client.HTTPException) as erro:
        raise ErroTicketmaster(
            f"falha de transporte ({type(erro).__name__})"
        ) from None
    except ValueError:
        raise ErroTicketmaster("resposta não é JSON válido") from None


def _eh_contagem(valor):
    return type(valor) is int and valor >= 0


def _totais(dados):
    """Sem `totalElements`/`totalPages` não dá para saber se veio tudo."""
    info = dados.get("page") if isinstance(dados, dict) else None
    if isinstance(info, dict):
        total = info.get("totalElements")
        paginas = info.get("totalPages")
        if _eh_contagem(total) and _eh_contagem(paginas):
            return total, paginas
    raise ErroTicketmaster("resposta sem dados de paginação")


def _eventos_da_pagina(dados):
    """Eventos da página; `_embedded` só vem quando há conteúdo."""
    embutido = dados.get("_embedded")
    if embutido is None:
        return []
    if isinstance(embutido, dict):
        eventos = embutido.get("events")
        if eventos is None:
            return []
        if isinstance(eventos, list):
            return eventos
    raise ErroTicketmaster("resposta com eventos em formato inesperado")


def _distintos(eventos):
    """Quantos eventos diferentes; sem `id` em texto, cada um conta à parte."""
    ids = [e.get("id") if isinstance(e, dict) else None for e in eventos]
    textos = [i for i in ids if isinstance(i, str)]
    return len(set(textos)) + len(ids) - len(textos)


def buscar_todos(inicio, buscar=None, pausa=0.25):
    """Junta os eventos de todas as páginas, com pausa entre chamadas."""
    if buscar is None:
        buscar = buscar_pagina
    eventos = []
    pagina = 0
    esperados = 0
    while True:
        dados = buscar(pagina, inicio)
        total, paginas = _totais(dados)
        if total > LIMITE_EVENTOS:
            raise ErroTicketmaster(
                "mais de 1000 eventos; a importação precisa fatiar por datas"
            )
        esperados = max(esperados, total)
        eventos.extend(_eventos_da_pagina(dados))
        if pagina >= paginas - 1:
            recebidos = _distintos(eventos)
            if recebidos < esperados:
                raise ErroTicketmaster(
                    f"resposta incompleta: {recebidos} de {esperados} eventos"
                )
            return eventos
        pagina += 1
        time.sleep(pausa)
