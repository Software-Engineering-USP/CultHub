"""Cidade dos locais sem cidade, a partir da coordenada (Photon)."""

import logging
import time
from dataclasses import dataclass, field

from localidades.municipios import municipio_oficial, sigla_do_estado
from rotas.photon import ErroPhoton, buscar_cidade_e_estado
from rotas.transporte import Espacador

from .models import Local, Provedor

# O servidor público do Photon pede uso "razoável": uma consulta por vez,
# com folga de mais de um segundo entre elas.
INTERVALO = 1.1
# Erros seguidos (não passageiros) que fazem desconfiar do servidor, e não
# dos locais: a geocodificação para em vez de pular todos.
MAXIMO_ERROS_SEGUIDOS = 3

logger = logging.getLogger(__name__)
# Vale entre chamadas de `completar_cidades` (o comando faz duas seguidas).
# `dormir` olha `time.sleep` na hora, para os testes poderem trocá-lo.
_vez = Espacador(
    INTERVALO,
    espera_maxima=float("inf"),
    dormir=lambda segundos: time.sleep(segundos),
)


@dataclass
class ResumoGeocodificacao:
    conferidos: int = 0
    descobertos: int = 0
    # Locais que deram erro no Photon (não passageiro) e foram pulados; ficam
    # pendentes para a próxima importação.
    com_erro: list = field(default_factory=list)
    # Mensagem da falha que interrompeu a geocodificação, se houve.
    falha: str = ""


def pendentes():
    """Locais do Ticketmaster no Brasil sem cidade e ainda não conferidos.

    Só os que têm coordenada. Os cadastrados à mão ficam como o admin
    deixou.
    """
    return Local.objects.filter(
        provedor=Provedor.TICKETMASTER,
        cidade="",
        pais__in=("", "BR"),
        latitude__isnull=False,
        longitude__isnull=False,
        geocodificado_em__isnull=True,
    ).order_by("pk")


def _localidade(local):
    """(município oficial, UF) do local, ou ("", "") se não der para saber.

    Só vale o par que existe na lista do IBGE. A UF vem do Photon, e não do
    Ticketmaster, porque a coordenada erra menos que o estado informado
    (já veio um local de Medianeira/PR marcado como PB). Sem estado na
    resposta do Photon, vale a UF que o local já tinha.
    """
    resposta = buscar_cidade_e_estado(
        float(local.latitude), float(local.longitude)
    )
    if resposta is None:
        return "", ""
    cidade, estado = resposta
    uf = sigla_do_estado(estado) or local.estado.strip().upper()
    cidade = municipio_oficial(cidade, uf)
    return (cidade, uf) if cidade else ("", "")


def completar_cidades(agora, limite=None, ignorar=()):
    """Descobre a cidade de até `limite` locais pendentes (todos se None).

    `ignorar`: pks que não devem ser consultados (ex.: os que já deram
    erro nesta execução). Cada local é gravado logo depois da consulta.
    Local conferido (com ou sem cidade descoberta) não é consultado de
    novo enquanto a coordenada não mudar (ver `_salvar_local`).

    Falha passageira do Photon (rede, 5xx, limite de uso) interrompe:
    os que faltaram ficam para a próxima vez. Erro de um local só (4xx,
    resposta inválida) pula aquele local, que continua pendente, para ele
    não travar os outros; depois de `MAXIMO_ERROS_SEGUIDOS` seguidos, para.
    """
    resumo = ResumoGeocodificacao()
    locais = list(pendentes().exclude(pk__in=ignorar)[:limite])
    erros_seguidos = 0
    for local in locais:
        _vez.aguardar()
        try:
            cidade, uf = _localidade(local)
        except ErroPhoton as erro:
            erros_seguidos += 1
            if erro.passageira or erros_seguidos >= MAXIMO_ERROS_SEGUIDOS:
                logger.warning("Geocodificação interrompida: %s", erro)
                resumo.falha = str(erro)
                break
            logger.warning(
                "Local %s pulado na geocodificação: %s", local.pk, erro
            )
            resumo.com_erro.append(local.pk)
            continue
        erros_seguidos = 0
        campos = {"geocodificado_em": agora}
        if cidade:
            campos.update(cidade=cidade, estado=uf)
            resumo.descobertos += 1
        Local.objects.filter(pk=local.pk).update(**campos)
        resumo.conferidos += 1
    return resumo
