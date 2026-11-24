"""Guarda o que o Ticketmaster informou, para combinar com o Photon.

Antes, a cidade do Ticketmaster era conferida com a UF dele e gravada em
`cidade`, e a geocodificação recombinava a partir daí: a cidade que não
era da UF do Ticketmaster, mas era da UF da coordenada, já tinha sumido.
Agora a entrada fica em `cidade_informada`/`estado_informado`, e
`cidade`/`estado` são só o resultado de `geocodificacao.combinar`.

Para os locais que já existem, a melhor entrada disponível é a
cidade/UF de hoje; a importação seguinte grava a entrada de verdade. Todo
local do Ticketmaster com coordenada volta para a fila (agora todos são
conferidos uma vez, não só os sem cidade). A resposta provisória do
Photon dos locais que ele já tinha corrigido foi guardada pela 0008; esta
não inventa resposta para os outros, para o nome do Ticketmaster nunca
passar por resposta do Photon.
"""

from django.db import migrations, models
from django.db.models import F


def copiar_e_geocodificar_de_novo(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    do_ticketmaster = modelo.objects.filter(provedor="ticketmaster")
    do_ticketmaster.update(
        cidade_informada=F("cidade"), estado_informado=F("estado")
    )
    do_ticketmaster.filter(
        latitude__isnull=False, longitude__isnull=False
    ).update(geocodificado_em=None)


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0008_local_resposta_do_photon")]

    operations = [
        migrations.AddField(
            model_name="local",
            name="cidade_informada",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="local",
            name="estado_informado",
            field=models.CharField(blank=True, max_length=2),
        ),
        migrations.RunPython(
            copiar_e_geocodificar_de_novo,
            migrations.RunPython.noop,
            elidable=True,
        ),
    ]
