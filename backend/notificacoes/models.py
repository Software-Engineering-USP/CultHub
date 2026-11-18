import uuid

from django.conf import settings
from django.db import models


class Notificacao(models.Model):
    """Lembrete persistente de um evento da agenda do usuário."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificacoes",
    )
    evento = models.ForeignKey(
        "catalogo.Evento",
        on_delete=models.CASCADE,
        related_name="notificacoes",
    )
    criada_em = models.DateTimeField(auto_now_add=True)
    lida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-criada_em", "id")
        constraints = (
            models.UniqueConstraint(
                fields=("usuario", "evento"),
                name="lembrete_unico_por_usuario_evento",
            ),
        )

    def __str__(self):
        return f"Lembrete de {self.evento} para {self.usuario}"
