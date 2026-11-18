import uuid

from django.conf import settings
from django.db import models


class TipoNotificacao(models.TextChoices):
    # Evento salvo ou confirmado que está para começar.
    LEMBRETE = "lembrete", "Lembrete"
    # Evento que entrou no catálogo e combina com as preferências.
    EVENTO_NOVO = "evento_novo", "Evento novo"


class Notificacao(models.Model):
    """Aviso persistente sobre um evento, para um usuário."""

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
    tipo = models.CharField(
        max_length=20,
        choices=TipoNotificacao.choices,
        default=TipoNotificacao.LEMBRETE,
    )
    criada_em = models.DateTimeField(auto_now_add=True)
    lida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-criada_em", "id")
        constraints = (
            models.UniqueConstraint(
                fields=("usuario", "evento", "tipo"),
                name="notificacao_unica_por_usuario_evento_tipo",
            ),
        )

    def __str__(self):
        return (
            f"{self.get_tipo_display()} de {self.evento} para {self.usuario}"
        )
