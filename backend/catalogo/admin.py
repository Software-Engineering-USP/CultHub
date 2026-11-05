from django.contrib import admin

from catalogo.models import (
    CategoriaCultural,
    Evento,
    FaixaPreco,
    ImagemEvento,
    Local,
)


@admin.register(CategoriaCultural)
class CategoriaCulturalAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nome")


@admin.register(Local)
class LocalAdmin(admin.ModelAdmin):
    list_display = ("nome", "cidade", "estado", "provedor")
    search_fields = ("nome",)
    list_filter = ("provedor",)


class FaixaPrecoInline(admin.TabularInline):
    model = FaixaPreco
    extra = 0


class ImagemEventoInline(admin.TabularInline):
    model = ImagemEvento
    extra = 0


@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    inlines = (FaixaPrecoInline, ImagemEventoInline)
    filter_horizontal = ("categorias",)
    list_display = (
        "titulo",
        "data_inicio",
        "local",
        "provedor",
        "removido_em",
    )
    list_filter = (
        "provedor",
        "categorias",
        ("removido_em", admin.EmptyFieldListFilter),
    )
    search_fields = ("titulo",)
    autocomplete_fields = ("local",)
    readonly_fields = (
        "provedor",
        "id_externo",
        "classificacoes",
        "inicio",
        "fim",
        "importado_em",
        "sincronizado_em",
        "removido_em",
    )
