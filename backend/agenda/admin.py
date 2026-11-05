from django.contrib import admin

from agenda.models import InteresseEmEvento, PresencaEmEvento


class MarcacaoAdmin(admin.ModelAdmin):
    """Somente consulta (e remoção): marcações são feitas pela API."""

    list_display = ("usuario", "evento", "marcado_em")
    list_filter = ("marcado_em",)
    search_fields = ("usuario__email", "evento__titulo")
    list_select_related = ("usuario", "evento")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(InteresseEmEvento)
class InteresseEmEventoAdmin(MarcacaoAdmin):
    pass


@admin.register(PresencaEmEvento)
class PresencaEmEventoAdmin(MarcacaoAdmin):
    pass
