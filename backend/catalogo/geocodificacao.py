"""Cidade dos locais sem cidade, a partir da coordenada (Photon)."""

import logging
import time
from dataclasses import dataclass

from localidades.municipios import municipio_oficial, sigla_do_estado
from rotas.photon import ErroPhoton, buscar_cidade_e_estado

from .models import Local, Provedor

# O servidor público do Photon pede uso "razoável": uma consulta por vez,
# com folga de mais de um segundo entre elas.
INTERVALO = 1.1

logger = logging.getLogger(__name__)


@dataclass
class ResumoGeocodificacao:
    conferidos: int = 0
    descobertos: int = 0
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


def completar_cidades(agora, limite=None):
    """Descobre a cidade de até `limite` locais pendentes (todos se None).

    Para na primeira falha do Photon; os que faltaram ficam para a próxima
    vez. Cada local é gravado logo depois da consulta. Local conferido
    (com ou sem cidade descoberta) não é consultado de novo enquanto a
    coordenada não mudar (ver `_salvar_local`).
    """
    resumo = ResumoGeocodificacao()
    locais = list(pendentes()[:limite])
    for indice, local in enumerate(locais):
        if indice:
            time.sleep(INTERVALO)
        try:
            cidade, uf = _localidade(local)
        except ErroPhoton as erro:
            logger.warning("Geocodificação interrompida: %s", erro)
            resumo.falha = str(erro)
            break
        campos = {"geocodificado_em": agora}
        if cidade:
            campos.update(cidade=cidade, estado=uf)
            resumo.descobertos += 1
        Local.objects.filter(pk=local.pk).update(**campos)
        resumo.conferidos += 1
    return resumo
