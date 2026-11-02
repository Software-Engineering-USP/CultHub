import uuid

from django.db import models


# Categoria cultural usada nas preferências do usuário e, depois, nos eventos.
# O `codigo` é o mesmo `CategoryId` usado pelo frontend.
class CategoriaCultural(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.SlugField(max_length=30, unique=True)
    nome = models.CharField(max_length=60)

    class Meta:
        ordering = ("nome",)
        verbose_name = "categoria cultural"
        verbose_name_plural = "categorias culturais"

    def __str__(self):
        return self.nome
