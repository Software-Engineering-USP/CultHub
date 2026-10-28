from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from catalogo.models import CategoriaCultural, Evento, Local

# Av. Paulista, São Paulo.
LATITUDE_PAULISTA = Decimal("-23.561414")
LONGITUDE_PAULISTA = Decimal("-46.655881")


def criar_evento(categorias=(), **campos):
    """Evento manual com padrões; `categorias` recebe códigos."""
    campos.setdefault("titulo", "Evento")
    campos.setdefault("data_inicio", timezone.localdate() + timedelta(days=1))
    if "local" not in campos:
        campos["local"] = Local.objects.create(
            nome="Local",
            endereco="Av. Paulista, 1000",
            cidade="São Paulo",
            estado="SP",
            latitude=LATITUDE_PAULISTA,
            longitude=LONGITUDE_PAULISTA,
        )
    evento = Evento.objects.create(**campos)
    if categorias:
        evento.categorias.set(
            CategoriaCultural.objects.filter(codigo__in=categorias)
        )
    return evento
