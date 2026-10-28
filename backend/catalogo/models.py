import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from django.db import models
from django.db.models import Q


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


class Provedor(models.TextChoices):
    TICKETMASTER = "ticketmaster", "Ticketmaster"
    MANUAL = "manual", "Manual"


# Local (casa de show, teatro...) de um evento, importado ou cadastrado.
class Local(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provedor = models.CharField(
        max_length=20, choices=Provedor.choices, default=Provedor.MANUAL
    )
    id_externo = models.CharField(max_length=64, blank=True)
    nome = models.CharField(max_length=200)
    endereco = models.CharField(max_length=300, blank=True)
    cidade = models.CharField(max_length=100, blank=True)
    estado = models.CharField(max_length=2, blank=True)
    pais = models.CharField(max_length=2, default="BR")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    class Meta:
        ordering = ("nome",)
        verbose_name_plural = "locais"
        constraints = (
            models.UniqueConstraint(
                fields=["provedor", "id_externo"],
                condition=~Q(id_externo=""),
                name="local_provedor_id_externo_unico",
            ),
        )

    def __str__(self):
        return self.nome


# Evento do catálogo: importado de um provedor ou cadastrado manualmente.
class Evento(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provedor = models.CharField(
        max_length=20, choices=Provedor.choices, default=Provedor.MANUAL
    )
    id_externo = models.CharField(max_length=64, blank=True)
    titulo = models.CharField(max_length=300)
    descricao = models.TextField(blank=True)
    avisos = models.TextField(blank=True)
    url_externa = models.URLField(max_length=500, blank=True)
    situacao = models.CharField(max_length=30, blank=True)
    local = models.ForeignKey(
        Local,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="eventos",
    )
    data_inicio = models.DateField()
    hora_inicio = models.TimeField(null=True, blank=True)
    # Calculado em `save()` a partir de data/hora e `fuso`.
    inicio = models.DateTimeField(null=True, editable=False)
    data_fim = models.DateField(null=True, blank=True)
    hora_fim = models.TimeField(null=True, blank=True)
    fim = models.DateTimeField(null=True, editable=False)
    fuso = models.CharField(max_length=50, default="America/Sao_Paulo")
    gratuito = models.BooleanField(default=False)
    genero = models.CharField(max_length=100, blank=True)
    classificacoes = models.JSONField(default=list, blank=True)
    categorias = models.ManyToManyField(
        CategoriaCultural, blank=True, related_name="eventos"
    )
    importado_em = models.DateTimeField(auto_now_add=True)
    sincronizado_em = models.DateTimeField(null=True, blank=True)
    removido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("data_inicio", "hora_inicio", "titulo")
        constraints = (
            models.UniqueConstraint(
                fields=["provedor", "id_externo"],
                condition=~Q(id_externo=""),
                name="evento_provedor_id_externo_unico",
            ),
        )

    def __str__(self):
        return self.titulo

    def _momento(self, dia, hora):
        if dia is None or hora is None:
            return None
        return datetime.combine(dia, hora, tzinfo=ZoneInfo(self.fuso))

    def save(self, *args, **kwargs):
        self.inicio = self._momento(self.data_inicio, self.hora_inicio)
        self.fim = self._momento(self.data_fim, self.hora_fim)
        super().save(*args, **kwargs)


class FaixaPreco(models.Model):
    evento = models.ForeignKey(
        Evento, on_delete=models.CASCADE, related_name="faixas_preco"
    )
    tipo = models.CharField(max_length=30, blank=True)
    moeda = models.CharField(max_length=3, default="BRL")
    minimo = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    maximo = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    class Meta:
        verbose_name = "faixa de preço"
        verbose_name_plural = "faixas de preço"


class ImagemEvento(models.Model):
    evento = models.ForeignKey(
        Evento, on_delete=models.CASCADE, related_name="imagens"
    )
    url = models.URLField(max_length=500)
    proporcao = models.CharField(max_length=10, blank=True)
    largura = models.PositiveIntegerField(null=True, blank=True)
    altura = models.PositiveIntegerField(null=True, blank=True)
    fallback = models.BooleanField(default=False)

    class Meta:
        verbose_name = "imagem do evento"
        verbose_name_plural = "imagens do evento"
