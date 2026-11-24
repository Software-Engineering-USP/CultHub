"""Importação dos eventos do Ticketmaster para o catálogo."""

import uuid
from dataclasses import dataclass, field
from datetime import date, time
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.db import DataError, IntegrityError, transaction
from django.utils import timezone

from localidades.municipios import localizar_municipio, municipio_oficial

from .mapeamento import categorias_do_evento, genero_do_evento
from .models import (
    DATA_MAXIMA,
    DATA_MINIMA,
    PRECO_MAXIMO,
    CategoriaCultural,
    Evento,
    FaixaPreco,
    ImagemEvento,
    Local,
    Provedor,
)

FUSO_PADRAO = Evento._meta.get_field("fuso").default

# Dado ruim em um evento não derruba a importação inteira. Falha do próprio
# banco (ex.: OperationalError) continua interrompendo.
ERROS_DE_DADO = (
    KeyError,
    ValueError,
    TypeError,
    AttributeError,
    ArithmeticError,
    IntegrityError,
    # Postgres recusa texto acima do tamanho do campo e byte NUL.
    DataError,
    ValidationError,
)


class ErroImportacao(Exception):
    """Nenhum evento válido: o catálogo não pode ser alterado."""


@dataclass
class ResumoImportacao:
    criados: int = 0
    atualizados: int = 0
    removidos: int = 0
    ignorados: int = 0
    sem_categoria: list[str] = field(default_factory=list)
    com_erro: list[str] = field(default_factory=list)
    # Ids dos eventos criados nesta execução (para avisar os interessados).
    ids_criados: list[uuid.UUID] = field(default_factory=list)
    remocao_pulada: bool = False


def _objeto(dados, chave):
    """Subobjeto do JSON; ausente ou `null` vira {}."""
    return dados.get(chave) or {}


def _texto(dados, chave):
    """Texto do JSON; ausente ou `null` vira ""."""
    return dados.get(chave) or ""


def _venue(dados):
    venues = _objeto(dados, "_embedded").get("venues") or []
    return venues[0] if venues else None


def _decimal(valor):
    return None if valor in (None, "") else Decimal(str(valor))


CENTAVO = Decimal("0.01")
GRAU = Decimal("0.000001")


def _numero(valor, casas, minimo, maximo):
    """Número arredondado para `casas`; fora de [minimo, maximo] é erro.

    Arredonda antes de conferir o limite: 99999999.994 vira 99999999.99, que
    cabe no campo.
    """
    numero = _decimal(valor)
    if numero is None:
        return None
    if not numero.is_finite():
        raise ValueError(f"número inválido: {valor}")
    numero = numero.quantize(casas, rounding=ROUND_HALF_UP)
    if not minimo <= numero <= maximo:
        raise ValueError(f"fora da faixa: {valor}")
    return numero


def _data(valor):
    """Data do evento; fora dos anos aceitos é erro (ver `DATA_MINIMA`)."""
    dia = date.fromisoformat(valor)
    if not DATA_MINIMA <= dia <= DATA_MAXIMA:
        raise ValueError(f"data fora do intervalo: {valor}")
    return dia


def _preco(valor):
    return _numero(valor, CENTAVO, 0, PRECO_MAXIMO)


def _cidade_e_estado(venue, pais, tem_coordenada):
    """Cidade e UF do venue; no Brasil, a cidade é um município do IBGE.

    O Ticketmaster quase nunca manda a cidade, às vezes manda lixo
    ("Nocity") ou um bairro ("Pinheiros"), e às vezes omite a UF ou manda
    uma que não existe; ver `localizar_municipio`, que não troca a UF.
    Sem UF válida, a cidade só completa a UF se não houver coordenada; com
    coordenada, o local fica com o nome e sem UF, e o Photon decide (o
    nome pode ser de um bairro de outro estado), usando o nome como
    palpite se não achar nada (ver `geocodificacao._localidade`). Com o
    nome oficial, o filtro por cidade das notificações compara nomes
    escritos do mesmo jeito.
    """
    cidade = _texto(_objeto(venue, "city"), "name")
    estado = _texto(_objeto(venue, "state"), "stateCode")
    if pais not in ("", "BR"):
        return cidade, estado
    return localizar_municipio(cidade, estado, completar_uf=not tem_coordenada)


def _manter_geocodificacao(anterior, dados):
    """Ajusta `dados` para manter o que a geocodificação de `anterior` achou.

    - O Photon achou a cidade: ficam a cidade e a UF dela.
    - Não achou, e o Ticketmaster agora manda um nome (palpite, sem UF):
      com a UF da geocodificação, o nome vale se for dela; sem UF
      nenhuma, o local volta para o Photon, que usa o palpite.
    - Não achou, e o Ticketmaster não manda nome: vale a UF dele, que pode
      ter sido corrigida; sem ela, fica a da geocodificação.
    """
    if anterior.cidade:
        del dados["cidade"], dados["estado"]
    elif dados["cidade"]:
        if not anterior.estado:
            return
        dados["cidade"] = municipio_oficial(dados["cidade"], anterior.estado)
        dados["estado"] = anterior.estado
    elif not dados["estado"]:
        del dados["cidade"], dados["estado"]
    del dados["geocodificado_em"]


def _salvar_local(venue):
    if venue is None:
        return None
    coordenadas = _objeto(venue, "location")
    pais = _texto(_objeto(venue, "country"), "countryCode")
    latitude = _numero(coordenadas.get("latitude"), GRAU, -90, 90)
    longitude = _numero(coordenadas.get("longitude"), GRAU, -180, 180)
    anterior = Local.objects.filter(
        provedor=Provedor.TICKETMASTER, id_externo=venue["id"]
    ).first()
    # Venue que veio sem `location` fica com a coordenada que já tinha (e
    # com o que a geocodificação descobriu a partir dela).
    if (
        anterior is not None
        and anterior.latitude is not None
        and latitude is None
        and longitude is None
    ):
        latitude, longitude = anterior.latitude, anterior.longitude
    cidade, estado = _cidade_e_estado(
        venue,
        pais,
        tem_coordenada=latitude is not None and longitude is not None,
    )
    dados = {
        "nome": _texto(venue, "name"),
        "endereco": _texto(_objeto(venue, "address"), "line1"),
        "cidade": cidade,
        "estado": estado,
        "pais": pais,
        "latitude": latitude,
        "longitude": longitude,
        "geocodificado_em": None,
        "geocodificacao_falhou_em": None,
    }
    mesma_coordenada = anterior is not None and (
        anterior.latitude,
        anterior.longitude,
    ) == (latitude, longitude)
    # Com a mesma coordenada, o erro anterior no Photon continua valendo
    # (o local segue no fim da fila de geocodificação).
    if mesma_coordenada:
        del dados["geocodificacao_falhou_em"]
    # Sem cidade e UF no Ticketmaster (o que mandaria o local de novo para o
    # Photon) e com a mesma coordenada, a conferência no Photon continua
    # valendo.
    if (
        mesma_coordenada
        and not (dados["cidade"] and dados["estado"])
        and anterior.geocodificado_em is not None
    ):
        _manter_geocodificacao(anterior, dados)
    local, _ = Local.objects.update_or_create(
        provedor=Provedor.TICKETMASTER,
        id_externo=venue["id"],
        defaults=dados,
    )
    return local


def _hora(inicio):
    if inicio.get("timeTBA") or inicio.get("noSpecificTime"):
        return None
    hora = inicio.get("localTime")
    return time.fromisoformat(hora) if hora else None


def _id_externo(dados):
    """`id` do evento em texto; `None` se não der para identificá-lo."""
    valor = dados.get("id") if isinstance(dados, dict) else None
    return valor if isinstance(valor, str) and valor else None


def _salvar_evento(dados, agora):
    id_externo = _id_externo(dados)
    if id_externo is None:
        raise ValueError("evento sem id")
    titulo = _texto(dados, "name").strip()
    if not titulo:
        raise ValueError("evento sem título")
    venue = _venue(dados)
    datas = _objeto(dados, "dates")
    inicio = _objeto(datas, "start")
    classificacoes = dados.get("classifications") or []
    evento, criado = Evento.objects.update_or_create(
        provedor=Provedor.TICKETMASTER,
        id_externo=id_externo,
        defaults={
            "titulo": titulo,
            "descricao": _texto(dados, "info"),
            "avisos": _texto(dados, "pleaseNote"),
            "url_externa": _texto(dados, "url"),
            "situacao": _texto(_objeto(datas, "status"), "code"),
            "local": _salvar_local(venue),
            "data_inicio": _data(inicio["localDate"]),
            "hora_inicio": _hora(inicio),
            "fuso": datas.get("timezone")
            or (venue or {}).get("timezone")
            or FUSO_PADRAO,
            "classificacoes": classificacoes,
            "genero": genero_do_evento(classificacoes),
            "sincronizado_em": agora,
            "removido_em": None,
        },
    )
    codigos = categorias_do_evento(classificacoes, evento.titulo)
    evento.categorias.set(CategoriaCultural.objects.filter(codigo__in=codigos))
    evento.imagens.all().delete()
    ImagemEvento.objects.bulk_create(
        ImagemEvento(
            evento=evento,
            url=imagem["url"],
            proporcao=_texto(imagem, "ratio"),
            largura=imagem.get("width"),
            altura=imagem.get("height"),
            fallback=bool(imagem.get("fallback")),
        )
        for imagem in dados.get("images") or []
    )
    evento.faixas_preco.all().delete()
    FaixaPreco.objects.bulk_create(
        FaixaPreco(
            evento=evento,
            tipo=_texto(faixa, "type"),
            moeda=faixa.get("currency") or "BRL",
            minimo=_preco(faixa.get("min")),
            maximo=_preco(faixa.get("max")),
        )
        for faixa in dados.get("priceRanges") or []
    )
    return evento, criado, bool(codigos)


def _descrever_erro(dados):
    if not isinstance(dados, dict):
        return f"?: não é objeto ({type(dados).__name__})"
    return f"{dados.get('id', '?')}: {dados.get('name') or '?'}"


def _contabilizar(resumo, evento, criado, tem_categoria):
    if criado:
        resumo.criados += 1
        resumo.ids_criados.append(evento.pk)
    else:
        resumo.atualizados += 1
    if not tem_categoria:
        resumo.sem_categoria.append(evento.titulo)


def _remover_ausentes(presentes, agora):
    # A busca começa hoje (data local), então a ausência de um evento que já
    # começou não significa remoção: só ficam elegíveis os que começam hoje
    # ou depois.
    return (
        Evento.objects.filter(
            provedor=Provedor.TICKETMASTER,
            removido_em__isnull=True,
            data_inicio__gte=timezone.localdate(agora),
        )
        .exclude(id_externo__in=presentes)
        .update(removido_em=agora)
    )


@transaction.atomic
def importar(eventos, agora):
    resumo = ResumoImportacao()
    vistos = set()
    ids_com_erro = set()
    for dados in eventos:
        try:
            situacao = _objeto(_objeto(dados, "dates"), "status").get("code")
            if dados.get("test") is True or situacao == "cancelled":
                resumo.ignorados += 1
                continue
            with transaction.atomic():
                evento, criado, tem_categoria = _salvar_evento(dados, agora)
        except ERROS_DE_DADO:
            resumo.ignorados += 1
            resumo.com_erro.append(_descrever_erro(dados))
            ids_com_erro.add(_id_externo(dados))
            continue
        vistos.add(evento.id_externo)
        _contabilizar(resumo, evento, criado, tem_categoria)
    if resumo.com_erro and not vistos:
        raise ErroImportacao(
            f"nenhum evento válido ({len(resumo.com_erro)} com erro; "
            f"primeiro: {resumo.com_erro[0]}); nada foi alterado."
        )
    # Item com erro e sem id pode ser qualquer evento do catálogo: sem saber
    # qual, nada é removido. Com id, o evento veio na resposta e continua no
    # catálogo com os dados antigos.
    if None in ids_com_erro:
        resumo.remocao_pulada = True
    else:
        resumo.removidos = _remover_ausentes(vistos | ids_com_erro, agora)
    return resumo
