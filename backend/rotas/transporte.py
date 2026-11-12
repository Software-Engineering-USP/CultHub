"""Transporte HTTP comum aos clientes do Photon e do OSRM."""

import http.client
import json
import math
import urllib.error
import urllib.request

USER_AGENT = (
    "CultHub/1.0 (MAC0332 USP; "
    "+https://github.com/Software-Engineering-USP/CultHub)"
)
RESPOSTA_INVALIDA = "resposta inválida"


class _FalhaPassageira(Exception):
    """Falha que vale tentar de novo (rede, tempo esgotado, HTTP 5xx)."""


def numero(valor):
    """Se `valor` é um número finito (int ou float, mas não bool)."""
    if not isinstance(valor, (int, float)) or isinstance(valor, bool):
        return False
    try:
        return math.isfinite(valor)
    except OverflowError:
        return False


def _requisitar(url, servico, erro, timeout, ler_erro_http):
    try:
        requisicao = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT}
        )
    except ValueError:
        raise erro(f"URL do {servico} inválida") from None
    try:
        with urllib.request.urlopen(requisicao, timeout=timeout) as resposta:
            return json.load(resposta)
    except urllib.error.HTTPError as falha:
        mensagem = f"{servico} respondeu HTTP {falha.code}"
        if falha.code >= 500:
            raise _FalhaPassageira(mensagem) from None
        dados = ler_erro_http(falha) if ler_erro_http else None
        if dados is not None:
            return dados
        raise erro(mensagem) from None
    except urllib.error.URLError as falha:
        raise _FalhaPassageira(
            f"falha de rede ({type(falha.reason).__name__})"
        ) from None
    except TimeoutError:
        raise _FalhaPassageira("tempo esgotado") from None
    except (OSError, http.client.HTTPException) as falha:
        raise _FalhaPassageira(
            f"falha de transporte ({type(falha).__name__})"
        ) from None
    except ValueError:
        raise erro(RESPOSTA_INVALIDA) from None


def obter_json(
    url, *, servico, erro, timeout, tentativas=2, ler_erro_http=None
):
    """JSON de `url`, com nova tentativa imediata em falha passageira.

    Toda falha vira `erro(mensagem)`; a mensagem nunca leva a URL.
    `ler_erro_http` recebe o `HTTPError` 4xx e devolve o JSON a usar como
    resposta, ou None para tratá-lo como erro.
    """
    ultima_falha = None
    for _ in range(tentativas):
        try:
            return _requisitar(url, servico, erro, timeout, ler_erro_http)
        except _FalhaPassageira as falha:
            ultima_falha = str(falha)
    raise erro(ultima_falha)
