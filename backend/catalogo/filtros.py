from datetime import datetime
from math import isfinite

from django.db.models import FloatField, Q, Value
from django.db.models.functions import (
    ACos,
    Cast,
    Coalesce,
    Cos,
    Least,
    Radians,
    Sin,
)
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from catalogo.models import CategoriaCultural


def visiveis(queryset, agora):
    """Eventos não removidos e que ainda não terminaram."""
    hoje = timezone.localdate(agora)
    terminou = Q(fim__lt=agora) | Q(
        fim__isnull=True, data_fim_efetiva__lt=hoje
    )
    return (
        queryset.filter(removido_em__isnull=True)
        .annotate(data_fim_efetiva=Coalesce("data_fim", "data_inicio"))
        .exclude(terminou)
    )


def _busca(queryset, texto):
    texto = texto.strip()
    if not texto:
        return queryset
    return queryset.filter(
        Q(titulo__icontains=texto)
        | Q(descricao__icontains=texto)
        | Q(local__nome__icontains=texto)
    )


def _categorias(queryset, valor):
    codigos = [c.strip() for c in valor.split(",") if c.strip()]
    if not codigos:
        return queryset
    existentes = set(
        CategoriaCultural.objects.filter(codigo__in=codigos).values_list(
            "codigo", flat=True
        )
    )
    invalidos = sorted(set(codigos) - existentes)
    if invalidos:
        raise ValidationError(
            {"categorias": [f"Categoria inexistente: {', '.join(invalidos)}."]}
        )
    return queryset.filter(categorias__codigo__in=codigos).distinct()


def _preco(queryset, valor):
    if valor == "gratuito":
        return queryset.filter(gratuito=True)
    if valor == "pago":
        return queryset.filter(gratuito=False)
    raise ValidationError({"preco": ["Use 'gratuito' ou 'pago'."]})


def _data(parametro, valor):
    try:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError(
            {parametro: ["Data inválida. Use o formato AAAA-MM-DD."]}
        )


def _periodo(queryset, params):
    de = _data("de", params["de"]) if "de" in params else None
    ate = _data("ate", params["ate"]) if "ate" in params else None
    if de and ate and de > ate:
        raise ValidationError(
            {"ate": ["A data final não pode ser anterior à inicial."]}
        )
    if ate:
        queryset = queryset.filter(data_inicio__lte=ate)
    if de:
        queryset = queryset.annotate(
            fim_do_evento=Coalesce("data_fim", "data_inicio")
        ).filter(fim_do_evento__gte=de)
    return queryset


RAIO_DA_TERRA_KM = 6371.0


def _numero(parametro, valor, minimo=None, maximo=None):
    try:
        numero = float(valor)
    except ValueError:
        numero = None
    if numero is None or not isfinite(numero):
        raise ValidationError({parametro: ["Informe um número."]})
    if minimo is not None and numero < minimo:
        raise ValidationError({parametro: [f"Mínimo: {minimo:g}."]})
    if maximo is not None and numero > maximo:
        raise ValidationError({parametro: [f"Máximo: {maximo:g}."]})
    return numero


def _distancia(queryset, params):
    nomes = ("lat", "lng", "raio")
    presentes = [n for n in nomes if n in params]
    if not presentes:
        return queryset
    faltando = [n for n in nomes if n not in params]
    if faltando:
        mensagem = "Informe lat, lng e raio juntos."
        mensagem += f" Faltando: {', '.join(faltando)}."
        raise ValidationError({"non_field_errors": [mensagem]})
    lat = _numero("lat", params["lat"], -90, 90)
    lng = _numero("lng", params["lng"], -180, 180)
    raio = _numero("raio", params["raio"])
    if raio <= 0:
        raise ValidationError({"raio": ["O raio deve ser maior que zero."]})

    latitude = Cast("local__latitude", FloatField())
    longitude = Cast("local__longitude", FloatField())
    # Haversine (lei esférica dos cossenos); Least evita NaN no ACos
    # quando o ponto coincide e o arredondamento passa de 1.
    cosseno = Cos(Radians(Value(lat))) * Cos(Radians(latitude)) * Cos(
        Radians(longitude) - Radians(Value(lng))
    ) + Sin(Radians(Value(lat))) * Sin(Radians(latitude))
    return (
        queryset.filter(
            local__latitude__isnull=False, local__longitude__isnull=False
        )
        .annotate(
            distancia_km=RAIO_DA_TERRA_KM
            * ACos(Least(cosseno, Value(1.0)), output_field=FloatField())
        )
        .filter(distancia_km__lte=raio)
    )


def aplicar_filtros(queryset, params):
    """Aplica os filtros da querystring (combinados com E)."""
    if "q" in params:
        queryset = _busca(queryset, params["q"])
    if "categorias" in params:
        queryset = _categorias(queryset, params["categorias"])
    if "preco" in params:
        queryset = _preco(queryset, params["preco"])
    queryset = _periodo(queryset, params)
    queryset = _distancia(queryset, params)
    return queryset
