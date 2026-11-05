"""Importação dos eventos do Ticketmaster para o catálogo."""

from dataclasses import dataclass, field
from datetime import date, time
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from .mapeamento import categorias_do_evento, genero_do_evento
from .models import (
    CategoriaCultural,
    Evento,
    FaixaPreco,
    ImagemEvento,
    Local,
    Provedor,
)

FUSO_PADRAO = Evento._meta.get_field("fuso").default


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


def _salvar_local(venue):
    if venue is None:
        return None
    coordenadas = _objeto(venue, "location")
    local, _ = Local.objects.update_or_create(
        provedor=Provedor.TICKETMASTER,
        id_externo=venue["id"],
        defaults={
            "nome": _texto(venue, "name"),
            "endereco": _texto(_objeto(venue, "address"), "line1"),
            "cidade": _texto(_objeto(venue, "city"), "name"),
            "estado": _texto(_objeto(venue, "state"), "stateCode"),
            "pais": _texto(_objeto(venue, "country"), "countryCode"),
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
    titulo = _texto(dados, "name").strip()
    if not titulo:
        raise ValueError("evento sem título")
    venue = _venue(dados)
    datas = _objeto(dados, "dates")
    inicio = _objeto(datas, "start")
    classificacoes = dados.get("classifications") or []
    evento, criado = Evento.objects.update_or_create(
        provedor=Provedor.TICKETMASTER,
        id_externo=dados["id"],
        defaults={
            "titulo": titulo,
            "descricao": _texto(dados, "info"),
            "avisos": _texto(dados, "pleaseNote"),
            "url_externa": _texto(dados, "url"),
            "situacao": _texto(_objeto(datas, "status"), "code"),
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
            minimo=_decimal(faixa.get("min")),
            maximo=_decimal(faixa.get("max")),
        )
        for faixa in dados.get("priceRanges") or []
    )
    return evento, criado, bool(codigos)


@transaction.atomic
def importar(eventos, agora):
    resumo = ResumoImportacao()
    vistos = set()
    ids_com_erro = set()
    for dados in eventos:
        if not isinstance(dados, dict):
            resumo.ignorados += 1
            resumo.com_erro.append(f"?: não é objeto ({type(dados).__name__})")
            continue
        try:
            situacao = _objeto(_objeto(dados, "dates"), "status").get("code")
            if dados.get("test") is True or situacao == "cancelled":
                resumo.ignorados += 1
                continue
            with transaction.atomic():
                evento, criado, tem_categoria = _salvar_evento(dados, agora)
        except (
            KeyError,
            ValueError,
            TypeError,
            AttributeError,
            ArithmeticError,
            IntegrityError,
            ValidationError,
        ):
            # Dado ruim em um evento não derruba a importação inteira. Falha
            # do próprio banco (ex.: OperationalError) continua interrompendo.
            resumo.ignorados += 1
            resumo.com_erro.append(
                f"{dados.get('id', '?')}: {dados.get('name') or '?'}"
            )
            # Veio na resposta: continua no catálogo com os dados antigos.
            if isinstance(dados.get("id"), str):
                ids_com_erro.add(dados["id"])
            continue
        vistos.add(evento.id_externo)
        if criado:
            resumo.criados += 1
        else:
            resumo.atualizados += 1
        if not tem_categoria:
            resumo.sem_categoria.append(evento.titulo)
    if resumo.com_erro and not vistos:
        raise ErroImportacao(
            f"nenhum evento válido ({len(resumo.com_erro)} com erro; "
            f"primeiro: {resumo.com_erro[0]}); nada foi alterado."
        )
    resumo.removidos = (
        Evento.objects.filter(
            provedor=Provedor.TICKETMASTER, removido_em__isnull=True
        )
        .exclude(id_externo__in=vistos | ids_com_erro)
        .update(removido_em=agora)
    )
    return resumo
