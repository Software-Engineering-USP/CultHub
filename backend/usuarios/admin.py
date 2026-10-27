from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from usuarios.forms import UsuarioChangeForm, UsuarioCreationForm
from usuarios.models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    form = UsuarioChangeForm
    add_form = UsuarioCreationForm
    ordering = ("email",)
    list_display = ("email", "nome", "is_staff")
    search_fields = ("email", "nome")
    filter_horizontal = ("preferencias", "groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ["email", "password"]}),
        (
            "Dados pessoais",
            {"fields": ["nome", "cidade", "bairro", "preferencias"]},
        ),
        (
            "Permissões",
            {
                "fields": [
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ]
            },
        ),
        ("Datas", {"fields": ["termos_aceitos_em", "last_login"]}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ["wide"],
                "fields": ["email", "nome", "password1", "password2"],
            },
        ),
    )
