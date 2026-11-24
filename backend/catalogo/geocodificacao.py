"""Cidade dos locais sem cidade, a partir da coordenada (Photon)."""

import logging
import time
from dataclasses import dataclass, field

from django.db.models import F, Q

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
    # Se a falha foi passageira (servidor ou rede fora), e não erros
    # seguidos em locais: aí não adianta consultar mais nada agora.
    passageira: bool = False


def pendentes():
    """Locais do Ticketmaster no Brasil a conferir no Photon.

    Os que têm coordenada, ainda não foram conferidos e estão sem cidade
    ou sem UF (cidade de vários estados, como "Bom Jesus"). Os que deram
    erro vão para o fim, do erro mais antigo para o mais novo, para não
    travar a fila. Os cadastrados à mão ficam como o admin deixou.
    """
    return Local.objects.filter(
        Q(cidade="") | Q(estado=""),
        provedor=Provedor.TICKETMASTER,
        pais__in=("", "BR"),
        latitude__isnull=False,
        longitude__isnull=False,
        geocodificado_em__isnull=True,
    ).order_by(F("geocodificacao_falhou_em").asc(nulls_first=True), "pk")


def _localidade(local):
    """(município oficial, UF) do local, ou ("", "") se não der para saber.

    Só vale o par que existe na lista do IBGE. A UF vem do Photon, e não do
    Ticketmaster, porque a coordenada erra menos que o estado informado
    (já veio um local de Medianeira/PR marcado como PB). Sem estado na
    resposta do Photon, vale a UF que o local já tinha.
    """
    resposta = buscar_cidade_e_estado(
        float(local.latitude),
        float(local.longitude),
        antes_de_tentar=_vez.aguardar,
    )
    if resposta is None:
        return "", ""
    cidade, estado = resposta
    uf = sigla_do_estado(estado) or sigla_do_estado(local.estado)
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
    resposta inválida) marca `geocodificacao_falhou_em` e segue para o
    próximo; o local continua pendente, no fim da fila. Depois de
    `MAXIMO_ERROS_SEGUIDOS` seguidos, desconfia do servidor e para.
    """
    resumo = ResumoGeocodificacao()
    locais = list(pendentes().exclude(pk__in=ignorar)[:limite])
    erros_seguidos = 0
    for local in locais:
        try:
            cidade, uf = _localidade(local)
        except ErroPhoton as erro:
            if erro.passageira:
                logger.warning("Geocodificação interrompida: %s", erro)
                resumo.falha = str(erro)
                resumo.passageira = True
                break
            logger.warning(
                "Local %s pulado na geocodificação: %s", local.pk, erro
            )
            Local.objects.filter(pk=local.pk).update(
                geocodificacao_falhou_em=agora
            )
            resumo.com_erro.append(local.pk)
            erros_seguidos += 1
            if erros_seguidos >= MAXIMO_ERROS_SEGUIDOS:
                logger.warning("Geocodificação interrompida: %s", erro)
                resumo.falha = str(erro)
                break
            continue
        erros_seguidos = 0
        campos = {"geocodificado_em": agora}
        if cidade:
            campos.update(cidade=cidade, estado=uf)
            resumo.descobertos += 1
        Local.objects.filter(pk=local.pk).update(**campos)
        resumo.conferidos += 1
    return resumo
