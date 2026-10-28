from django.db.models import Q
from django.db.models.functions import Coalesce
from django.utils import timezone


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


def aplicar_filtros(queryset, params):
    """Aplica os filtros da querystring (acrescentados nas próximas etapas)."""
    return queryset
