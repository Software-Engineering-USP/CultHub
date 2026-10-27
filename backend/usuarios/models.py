import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    # `password` (e não `senha`): nome usado pelo `createsuperuser` do Django
    def create_user(self, email, password=None, **campos):
        if not email or not email.strip():
            raise ValueError("O e-mail é obrigatório.")
        usuario = self.model(email=email, **campos)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, password=None, **campos):
        campos.setdefault("is_staff", True)
        campos.setdefault("is_superuser", True)
        return self.create_user(email, password, **campos)


# Usuário do CultHub, com login por e-mail (Entrega 2, Figura 8)
class Usuario(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    nome = models.CharField(max_length=150)
    cidade = models.CharField(max_length=100, blank=True)
    bairro = models.CharField(max_length=100, blank=True)
    # Nulo só para superusuário criado pela linha de comando
    termos_aceitos_em = models.DateTimeField(null=True, blank=True)
    preferencias = models.ManyToManyField(
        "catalogo.CategoriaCultural", blank=True, related_name="usuarios"
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ("nome",)

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    def __str__(self):
        return self.email

    # Único lugar que normaliza o e-mail. O Django chama isto também na
    # validação do admin, antes de checar se o e-mail já existe.
    @classmethod
    def normalize_username(cls, username):
        return super().normalize_username(username).strip().lower()

    def save(self, *args, **kwargs):
        self.email = self.normalize_username(self.email)
        super().save(*args, **kwargs)

    @property
    def iniciais(self) -> str:
        partes = self.nome.split()
        if not partes:
            return ""
        if len(partes) == 1:
            return partes[0][0].upper()
        return (partes[0][0] + partes[-1][0]).upper()
