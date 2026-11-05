from django.db.models import DateTimeField, OuterRef, Subquery, Value

from agenda.models import InteresseEmEvento, PresencaEmEvento


def _marcado_em(modelo, usuario):
    return Subquery(
        modelo.objects.filter(usuario=usuario, evento=OuterRef("pk")).values(
            "marcado_em"
        )[:1]
    )


def anotar_marcacoes(eventos, usuario):
    """Anota `salvo_em` e `presenca_em` (marcado_em do usuário ou None)."""
    if not usuario.is_authenticated:
        nulo = Value(None, output_field=DateTimeField())
        return eventos.annotate(salvo_em=nulo, presenca_em=nulo)
    return eventos.annotate(
        salvo_em=_marcado_em(InteresseEmEvento, usuario),
        presenca_em=_marcado_em(PresencaEmEvento, usuario),
    )
