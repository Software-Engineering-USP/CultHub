"""Cidade dos locais sem cidade, a partir da coordenada (Photon)."""

import logging
import time
from dataclasses import dataclass

from localidades.municipios import municipio_oficial, sigla_do_estado
from rotas.photon import ErroPhoton, buscar_cidade_e_estado

from .models import Local

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
    """Locais no Brasil com coordenada, sem cidade e ainda não conferidos."""
    return Local.objects.filter(
        cidade="",
        pais__in=("", "BR"),
        latitude__isnull=False,
        longitude__isnull=False,
        geocodificado_em__isnull=True,
    ).order_by("pk")


def _localidade(latitude, longitude):
    """(município oficial, UF) do ponto, ou ("", "") se não der para saber.

    Só vale o par que existe na lista do IBGE. A UF vem do Photon, e não do
    Ticketmaster, porque a coordenada erra menos que o estado informado
    (já veio um local de Medianeira/PR marcado como PB).
    """
    resposta = buscar_cidade_e_estado(float(latitude), float(longitude))
    if resposta is None:
        return "", ""
    cidade, estado = resposta
    uf = sigla_do_estado(estado)
    cidade = municipio_oficial(cidade, uf)
    return (cidade, uf) if cidade else ("", "")


def completar_cidades(agora):
    """Descobre a cidade dos locais pendentes; para na primeira falha.

    Local conferido (com ou sem cidade descoberta) não é consultado de
    novo enquanto a coordenada não mudar (ver `_salvar_local`). Se o
    Photon falhar, os que faltaram ficam para a próxima importação.
    """
    resumo = ResumoGeocodificacao()
    for indice, local in enumerate(list(pendentes())):
        if indice:
            time.sleep(INTERVALO)
        try:
            cidade, uf = _localidade(local.latitude, local.longitude)
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
