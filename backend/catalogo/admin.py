from django.contrib import admin

from catalogo.models import CategoriaCultural


@admin.register(CategoriaCultural)
class CategoriaCulturalAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nome")
