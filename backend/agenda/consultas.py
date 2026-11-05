from django.db.models import DateTimeField, OuterRef, Subquery, Value

from agenda.models import InteresseEmEvento, PresencaEmEvento


def _marcado_em(modelo, usuario):
    return Subquery(
        modelo.objects.filter(usuario=usuario, evento=OuterRef("pk")).values(
            "marcado_em"
        )[:1]
    )


def anotar_marcacoes(eventos, usuario, *, presenca=True):
    """Anota `salvo_em` e, se `presenca`, `presenca_em` (ou None)."""
    if not usuario.is_authenticated:
        nulo = Value(None, output_field=DateTimeField())
        anotacoes = {"salvo_em": nulo}
        if presenca:
            anotacoes["presenca_em"] = nulo
        return eventos.annotate(**anotacoes)
    anotacoes = {"salvo_em": _marcado_em(InteresseEmEvento, usuario)}
    if presenca:
        anotacoes["presenca_em"] = _marcado_em(PresencaEmEvento, usuario)
    return eventos.annotate(**anotacoes)
