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
