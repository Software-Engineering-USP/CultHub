import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from usuarios.managers import UsuarioManager


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
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ("nome",)

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        # E-mail sempre em minúsculas, venha da API, do admin ou do shell
        self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    @property
    def iniciais(self) -> str:
        partes = self.nome.split()
        if not partes:
            return ""
        if len(partes) == 1:
            return partes[0][0].upper()
        return (partes[0][0] + partes[-1][0]).upper()
