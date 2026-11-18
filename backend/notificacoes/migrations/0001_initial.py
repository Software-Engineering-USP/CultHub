import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("catalogo", "0003_modelos_evento"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notificacao",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("criada_em", models.DateTimeField(auto_now_add=True)),
                ("lida_em", models.DateTimeField(blank=True, null=True)),
                (
                    "evento",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notificacoes",
                        to="catalogo.evento",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notificacoes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ("-criada_em", "id")},
        ),
        migrations.AddConstraint(
            model_name="notificacao",
            constraint=models.UniqueConstraint(
                fields=("usuario", "evento"),
                name="lembrete_unico_por_usuario_evento",
            ),
        ),
    ]
