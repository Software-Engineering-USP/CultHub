from django.db.models import Q
from django.db.models.functions import Coalesce
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


def aplicar_filtros(queryset, params):
    """Aplica os filtros da querystring (combinados com E)."""
    if "q" in params:
        queryset = _busca(queryset, params["q"])
    if "categorias" in params:
        queryset = _categorias(queryset, params["categorias"])
    if "preco" in params:
        queryset = _preco(queryset, params["preco"])
    return queryset
