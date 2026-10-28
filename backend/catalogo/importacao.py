"""Importação dos eventos do Ticketmaster para o catálogo."""

import re
from dataclasses import dataclass, field
from datetime import date, time
from decimal import Decimal

from django.db import transaction

from .mapeamento import categorias_do_evento, genero_do_evento
from .models import (
    CategoriaCultural,
    Evento,
    FaixaPreco,
    ImagemEvento,
    Local,
    Provedor,
)

PADRAO_TESTE = re.compile(r"\btest(e)?\b", re.IGNORECASE)
FUSO_PADRAO = Evento._meta.get_field("fuso").default


@dataclass
class ResumoImportacao:
    criados: int = 0
    atualizados: int = 0
    removidos: int = 0
    ignorados: int = 0
    sem_categoria: list[str] = field(default_factory=list)


def _venue(dados):
    venues = dados.get("_embedded", {}).get("venues") or []
    return venues[0] if venues else None


def eh_evento_de_teste(dados):
    if dados.get("test") is True:
        return True
    venue = _venue(dados) or {}
    nomes = (dados.get("name", ""), venue.get("name", ""))
    return any(PADRAO_TESTE.search(nome) for nome in nomes)


def _decimal(valor):
    return None if valor in (None, "") else Decimal(str(valor))


def _salvar_local(venue):
    if venue is None:
        return None
    coordenadas = venue.get("location", {})
    local, _ = Local.objects.update_or_create(
        provedor=Provedor.TICKETMASTER,
        id_externo=venue["id"],
        defaults={
            "nome": venue.get("name", ""),
            "endereco": venue.get("address", {}).get("line1", ""),
            "cidade": venue.get("city", {}).get("name", ""),
            "estado": venue.get("state", {}).get("stateCode", ""),
            "pais": venue.get("country", {}).get("countryCode", ""),
            "latitude": _decimal(coordenadas.get("latitude")),
            "longitude": _decimal(coordenadas.get("longitude")),
        },
    )
    return local


def _hora(inicio):
    if inicio.get("timeTBA") or inicio.get("noSpecificTime"):
        return None
    hora = inicio.get("localTime")
    return time.fromisoformat(hora) if hora else None


def _salvar_evento(dados, agora):
    venue = _venue(dados)
    datas = dados.get("dates", {})
    inicio = datas.get("start", {})
    classificacoes = dados.get("classifications", [])
    evento, criado = Evento.objects.update_or_create(
        provedor=Provedor.TICKETMASTER,
        id_externo=dados["id"],
        defaults={
            "titulo": dados.get("name", ""),
            "descricao": dados.get("info", ""),
            "avisos": dados.get("pleaseNote", ""),
            "url_externa": dados.get("url", ""),
            "situacao": datas.get("status", {}).get("code", ""),
            "local": _salvar_local(venue),
            "data_inicio": date.fromisoformat(inicio["localDate"]),
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
            proporcao=imagem.get("ratio", ""),
            largura=imagem.get("width"),
            altura=imagem.get("height"),
            fallback=bool(imagem.get("fallback")),
        )
        for imagem in dados.get("images", [])
    )
    evento.faixas_preco.all().delete()
    FaixaPreco.objects.bulk_create(
        FaixaPreco(
            evento=evento,
            tipo=faixa.get("type", ""),
            moeda=faixa.get("currency", "BRL"),
            minimo=_decimal(faixa.get("min")),
            maximo=_decimal(faixa.get("max")),
        )
        for faixa in dados.get("priceRanges", [])
    )
    return evento, criado, bool(codigos)


@transaction.atomic
def importar(eventos, agora):
    resumo = ResumoImportacao()
    vistos = set()
    for dados in eventos:
        cancelado = dados.get("dates", {}).get("status", {}).get("code")
        if eh_evento_de_teste(dados) or cancelado == "cancelled":
            resumo.ignorados += 1
            continue
        evento, criado, tem_categoria = _salvar_evento(dados, agora)
        vistos.add(evento.id_externo)
        if criado:
            resumo.criados += 1
        else:
            resumo.atualizados += 1
        if not tem_categoria:
            resumo.sem_categoria.append(evento.titulo)
    resumo.removidos = (
        Evento.objects.filter(
            provedor=Provedor.TICKETMASTER, removido_em__isnull=True
        )
        .exclude(id_externo__in=vistos)
        .update(removido_em=agora)
    )
    return resumo
