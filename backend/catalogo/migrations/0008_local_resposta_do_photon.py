"""Guarda à parte o que o Photon respondeu para cada local.

Até aqui a resposta do Photon ia direto para `cidade`/`estado`, misturada
com o que veio do Ticketmaster, e não há como separá-la. Os locais já
geocodificados voltam para a fila: na próxima importação são consultados
de novo, e a cidade/UF gravada hoje entra como o dado do Ticketmaster
(ver `geocodificacao.combinar`), então nada se perde se o Photon não
responder.
"""

from django.db import migrations, models


def geocodificar_de_novo(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    modelo.objects.filter(
        geocodificado_em__isnull=False,
        latitude__isnull=False,
        longitude__isnull=False,
    ).update(geocodificado_em=None)


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0007_limpar_cidades_invalidas")]

    operations = [
        migrations.AddField(
            model_name="local",
            name="cidade_geocodificada",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="local",
            name="estado_geocodificado",
            field=models.CharField(blank=True, max_length=2),
        ),
        migrations.RunPython(
            geocodificar_de_novo, migrations.RunPython.noop, elidable=True
        ),
    ]
