"""Cidade e UF dos locais pela coordenada (Photon) e pelo Ticketmaster."""

import logging
import time
from dataclasses import dataclass, field

from django.db.models import F

from localidades.municipios import (
    localizar_municipio,
    municipio_oficial,
    sigla_do_estado,
)
from rotas.photon import ErroPhoton, buscar_cidade_e_estado
from rotas.transporte import Espacador

from .models import Evento, Local, Provedor

# O servidor público do Photon pede uso "razoável": uma consulta por vez,
# com folga de mais de um segundo entre elas.
INTERVALO = 1.1
# Erros seguidos (não passageiros) que fazem desconfiar do servidor, e não
# dos locais: a geocodificação para em vez de tentar todos.
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
    # Locais cuja cidade veio do Photon (e não só do Ticketmaster).
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

    Todos os que têm coordenada e ainda não foram conferidos, mesmo com
    cidade e UF do Ticketmaster: a coordenada erra menos (ver `combinar`).
    Cada um é conferido uma vez por coordenada. Os que deram erro vão para
    o fim, do erro mais antigo para o mais novo, para não travar a fila.
    Os cadastrados à mão ficam como o admin deixou.
    """
    return Local.objects.filter(
        provedor=Provedor.TICKETMASTER,
        pais__in=("", "BR"),
        latitude__isnull=False,
        longitude__isnull=False,
        geocodificado_em__isnull=True,
    ).order_by(F("geocodificacao_falhou_em").asc(nulls_first=True), "pk")


def combinar(cidade, uf, cidade_geocodificada, uf_geocodificada):
    """(cidade, UF) do local, do Ticketmaster e do que o Photon respondeu.

    `cidade`/`uf`: o que o Ticketmaster informou (ver
    `importacao._cidade_e_estado`): a cidade é um nome oficial do IBGE,
    ainda sem conferir com UF nenhuma, ou ""; a UF, uma sigla ou "".
    `cidade_geocodificada`: como o Photon escreveu; `uf_geocodificada`:
    sigla ou "" (vazias sem geocodificação).

    A coordenada erra menos que o Ticketmaster (já veio um local de
    Medianeira/PR marcado como PB), então, em ordem:

    1. UF: a do Photon; sem ela, a do Ticketmaster.
    2. Cidade do Photon, se for município dessa UF. Se o Photon não deu
       UF, ela pode completá-la quando o nome é de um estado só. Se ele
       deu UF e a cidade não é dela, a cidade é descartada e a UF fica.
    3. Sem cidade do Photon que valha: a do Ticketmaster, se for da UF.
       Sem UF de lugar nenhum, fica o nome sem UF: o nome do Ticketmaster
       nunca completa a UF, porque pode ser um bairro de outro estado
       ("Pinheiros", bairro de São Paulo, só é município no ES).
    """
    uf_final = uf_geocodificada or sigla_do_estado(uf)
    oficial = municipio_oficial(cidade_geocodificada, uf_final)
    if oficial:
        return oficial, uf_final
    if not uf_geocodificada:
        oficial, completada = localizar_municipio(cidade_geocodificada, "")
        if oficial and (completada or not uf_final):
            return oficial, completada
    return localizar_municipio(cidade, uf_final, completar_uf=False)


def _consultar(local):
    """(cidade, UF em sigla) que o Photon dá para a coordenada do local."""
    resposta = buscar_cidade_e_estado(
        float(local.latitude),
        float(local.longitude),
        antes_de_tentar=_vez.aguardar,
    )
    cidade, estado = resposta or ("", "")
    return cidade[:100], sigla_do_estado(estado)


def completar_cidades(
    agora,
    limite=None,
    so_sem_erro=False,
    maximo_erros_seguidos=MAXIMO_ERROS_SEGUIDOS,
    eventos=None,
):
    """Descobre a cidade de até `limite` locais pendentes (todos se None).

    `so_sem_erro`: deixa de fora os locais que já deram erro no Photon
    (inclusive nesta execução). `eventos`: só os locais desses eventos
    (ex.: os criados nesta importação). Cada local é gravado logo depois
    da consulta.
    Local conferido (com ou sem cidade achada) não é consultado de novo
    enquanto a coordenada não mudar (ver `importacao._salvar_local`).

    Falha passageira do Photon (rede, 5xx, limite de uso) interrompe:
    os que faltaram ficam para a próxima vez. Erro de um local só (4xx,
    resposta inválida) marca `geocodificacao_falhou_em` e segue para o
    próximo; o local continua pendente, no fim da fila. Depois de
    `maximo_erros_seguidos` seguidos, desconfia do servidor e para; só
    conta como interrupção (`falha`) se ainda havia local para consultar,
    para os que sempre falham, juntos no fim da fila, não interromperem
    toda importação.
    """
    resumo = ResumoGeocodificacao()
    locais = list(_fila(so_sem_erro, eventos)[:limite])
    erros_seguidos = 0
    for posicao, local in enumerate(locais, start=1):
        try:
            resposta = _consultar(local)
        except ErroPhoton as erro:
            if erro.passageira:
                _interromper(resumo, erro, passageira=True)
                break
            _marcar_erro(local, erro, agora, resumo)
            erros_seguidos += 1
            if erros_seguidos >= maximo_erros_seguidos:
                if posicao < len(locais):
                    _interromper(resumo, erro)
                break
            continue
        erros_seguidos = 0
        _gravar(local, resposta, agora, resumo)
    return resumo


def _fila(so_sem_erro, eventos):
    fila = pendentes()
    if so_sem_erro:
        fila = fila.filter(geocodificacao_falhou_em__isnull=True)
    if eventos is not None:
        fila = fila.filter(
            pk__in=Evento.objects.filter(pk__in=eventos).values("local")
        )
    return fila


def _interromper(resumo, erro, passageira=False):
    logger.warning("Geocodificação interrompida: %s", erro)
    resumo.falha = str(erro)
    resumo.passageira = passageira


def _marcar_erro(local, erro, agora, resumo):
    """Erro de um local só: vai para o fim da fila e continua pendente."""
    logger.warning("Local %s pulado na geocodificação: %s", local.pk, erro)
    Local.objects.filter(pk=local.pk).update(geocodificacao_falhou_em=agora)
    resumo.com_erro.append(local.pk)


def _gravar(local, resposta, agora, resumo):
    """Grava a resposta e a cidade/UF; conferido, o local sai da fila."""
    cidade, uf = combinar(
        local.cidade_informada, local.estado_informado, *resposta
    )
    # A cidade veio do Photon se ele, sozinho, já chega nela.
    if cidade and cidade == combinar("", "", *resposta)[0]:
        resumo.descobertos += 1
    Local.objects.filter(pk=local.pk).update(
        cidade=cidade,
        estado=uf,
        cidade_geocodificada=resposta[0],
        estado_geocodificado=resposta[1],
        geocodificado_em=agora,
    )
    resumo.conferidos += 1
