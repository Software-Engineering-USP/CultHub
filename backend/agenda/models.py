import uuid

from django.conf import settings
from django.db import models


class MarcacaoEvento(models.Model):
    """Marcação de um usuário sobre um evento (base de salvo e presença)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    marcado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.usuario} → {self.evento}"


class InteresseEmEvento(MarcacaoEvento):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interesses",
    )
    evento = models.ForeignKey(
        "catalogo.Evento",
        on_delete=models.CASCADE,
        related_name="interesses",
    )

    class Meta:
        verbose_name = "evento salvo"
        verbose_name_plural = "eventos salvos"
        constraints = (
            models.UniqueConstraint(
                fields=("usuario", "evento"),
                name="interesse_unico_por_usuario_e_evento",
            ),
        )


class PresencaEmEvento(MarcacaoEvento):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="presencas",
    )
    evento = models.ForeignKey(
        "catalogo.Evento",
        on_delete=models.CASCADE,
        related_name="presencas",
    )

    class Meta:
        verbose_name = "presença"
        verbose_name_plural = "presenças"
        constraints = (
            models.UniqueConstraint(
                fields=("usuario", "evento"),
                name="presenca_unica_por_usuario_e_evento",
            ),
        )
