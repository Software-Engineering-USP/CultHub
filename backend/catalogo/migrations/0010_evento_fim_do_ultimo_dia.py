"""`Evento.fim_do_ultimo_dia`: quando termina o evento sem horário de fim.

Antes, o evento sem `fim` saía da lista à meia-noite de São Paulo, mesmo
num fuso a oeste (Manaus, Rio Branco), ainda durante o evento. Agora vale
até a meia-noite do dia seguinte ao último dia, no fuso do próprio evento.
Esta migração calcula o campo dos eventos que já existem; `Evento.save`
calcula o dos novos.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import migrations, models


def calcular(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Evento")
    eventos = list(modelo.objects.only("data_inicio", "data_fim", "fuso"))
    for evento in eventos:
        ultimo_dia = evento.data_fim or evento.data_inicio
        evento.fim_do_ultimo_dia = datetime.combine(
            ultimo_dia + timedelta(days=1),
            time.min,
            tzinfo=ZoneInfo(evento.fuso),
        )
    modelo.objects.bulk_update(eventos, ["fim_do_ultimo_dia"], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0009_local_dados_informados")]

    operations = [
        migrations.AddField(
            model_name="evento",
            name="fim_do_ultimo_dia",
            field=models.DateTimeField(editable=False, null=True),
        ),
        migrations.RunPython(calcular, migrations.RunPython.noop),
    ]
