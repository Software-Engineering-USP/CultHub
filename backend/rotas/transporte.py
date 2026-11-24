"""Transporte HTTP comum aos clientes do Photon e do OSRM."""

import http.client
import json
import math
import threading
import time
import urllib.error
import urllib.request

USER_AGENT = (
    "CultHub/1.0 (MAC0332 USP; "
    "+https://github.com/Software-Engineering-USP/CultHub)"
)
RESPOSTA_INVALIDA = "resposta inválida"
# Com menos tempo que isso no prazo, nova tentativa não vale a pena.
TEMPO_MINIMO_TENTATIVA = 2
TAMANHO_DO_PEDACO = 64 * 1024


class _FalhaPassageira(Exception):
    """Falha que vale tentar de novo (rede, tempo esgotado, HTTP 5xx)."""


def _passageira(erro, mensagem):
    """`erro(mensagem)` marcado como passageiro (`passageira = True`).

    Quem chama pode querer parar de consultar o servidor por um tempo
    (rede, tempo esgotado, 5xx, limite de uso), em vez de tratar como um
    problema daquele pedido. As outras falhas ficam com `False`.
    """
    excecao = erro(mensagem)
    excecao.passageira = True
    return excecao


def numero(valor):
    """Se `valor` é um número finito (int ou float, mas não bool)."""
    if not isinstance(valor, (int, float)) or isinstance(valor, bool):
        return False
    try:
        return math.isfinite(valor)
    except OverflowError:
        return False


def _ler_json(resposta, fim):
    """JSON do corpo, lido aos pedaços para conferir o prazo `fim`."""
    pedacos = []
    while pedaco := resposta.read1(TAMANHO_DO_PEDACO):
        if fim is not None and time.monotonic() > fim:
            raise TimeoutError
        pedacos.append(pedaco)
    return json.loads(b"".join(pedacos))


def _requisitar(url, servico, erro, timeout, fim, ler_erro_http):
    try:
        requisicao = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT}
        )
    except ValueError:
        raise erro(f"URL do {servico} inválida") from None
    try:
        with urllib.request.urlopen(requisicao, timeout=timeout) as resposta:
            return _ler_json(resposta, fim)
    except urllib.error.HTTPError as falha:
        with falha:
            mensagem = f"{servico} respondeu HTTP {falha.code}"
            if falha.code >= 500:
                raise _FalhaPassageira(mensagem) from None
            dados = ler_erro_http(falha) if ler_erro_http else None
        if dados is not None:
            return dados
        # 429: limite de uso; tentar de novo na hora só piora.
        if falha.code == 429:
            raise _passageira(erro, mensagem) from None
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
    url,
    *,
    servico,
    erro,
    timeout,
    tentativas=2,
    prazo=None,
    antes_de_tentar=None,
    ler_erro_http=None,
):
    """JSON de `url`, com nova tentativa imediata em falha passageira.

    Toda falha vira `erro(mensagem)`; a mensagem nunca leva a URL. A
    passageira (rede, tempo, 5xx, 429) sai com `passageira = True`.

    - `prazo`: tempo total (s) para todas as tentativas, contando a espera
      de `antes_de_tentar`; a tentativa usa o que sobrar, até `timeout`.
      O prazo é conferido antes de cada tentativa e a cada pedaço lido;
      uma operação de rede isolada (conectar, ler um pedaço) ainda pode
      levar até `timeout`, e a resolução de DNS fica a cargo do sistema.
    - `antes_de_tentar`: chamado antes de cada tentativa (ex.: esperar a
      vez); pode levantar `erro`.
    - `ler_erro_http`: recebe o `HTTPError` 4xx e devolve o JSON a usar
      como resposta, ou None para tratá-lo como erro.
    """
    fim = None if prazo is None else time.monotonic() + prazo

    def sem_tempo():
        return (
            fim is not None and fim - time.monotonic() < TEMPO_MINIMO_TENTATIVA
        )

    ultima_falha = "prazo esgotado"
    for _ in range(tentativas):
        # Antes da fila, para não reservar uma vez que não será usada.
        if sem_tempo():
            break
        if antes_de_tentar is not None:
            antes_de_tentar()
        if sem_tempo():
            break
        limite = (
            timeout if fim is None else min(timeout, fim - time.monotonic())
        )
        try:
            return _requisitar(url, servico, erro, limite, fim, ler_erro_http)
        except _FalhaPassageira as falha:
            ultima_falha = str(falha)
    raise _passageira(erro, ultima_falha)


class Espacador:
    """Intervalo mínimo entre requisições a um servidor, neste processo.

    Cada chamada de `aguardar` reserva a próxima vez livre e dorme até
    ela. Se a fila já passar de `espera_maxima`, não reserva nada e
    devolve False, para a requisição falhar logo em vez de prender o
    worker.
    """

    def __init__(
        self,
        intervalo,
        espera_maxima,
        relogio=time.monotonic,
        dormir=time.sleep,
    ):
        self._intervalo = intervalo
        self._espera_maxima = espera_maxima
        self._relogio = relogio
        self._dormir = dormir
        self._trava = threading.Lock()
        self._proxima_vez = float("-inf")

    def aguardar(self):
        with self._trava:
            agora = self._relogio()
            vez = max(agora, self._proxima_vez)
            espera = vez - agora
            if espera > self._espera_maxima:
                return False
            self._proxima_vez = vez + self._intervalo
        if espera > 0:
            self._dormir(espera)
        return True
