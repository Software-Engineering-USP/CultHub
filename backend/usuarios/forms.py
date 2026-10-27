from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm

from usuarios.models import Usuario


# Formulários do admin: os padrões do Django são presos ao `auth.User`
class UsuarioCreationForm(BaseUserCreationForm):
    class Meta:
        model = Usuario
        fields = ("email", "nome")


class UsuarioChangeForm(UserChangeForm):
    class Meta:
        model = Usuario
        fields = "__all__"
