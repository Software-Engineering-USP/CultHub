"""Guarda à parte o que o Photon respondeu para cada local.

Até aqui a resposta do Photon ia direto para `cidade`/`estado`, misturada
com o que veio do Ticketmaster, e não há como separá-la. Os locais já
geocodificados (com coordenada) voltam para a fila, para serem
consultados de novo. Até lá, a cidade/UF que a geocodificação antiga
deixou fica como resposta provisória do Photon (ver
`geocodificacao.combinar`), para um local corrigido (Medianeira/PR, com
o Ticketmaster dizendo PB) não voltar aos dados do Ticketmaster se o
Photon estiver fora. Só com UF: sem ela, `combinar` completaria a UF
pelo nome, que pode ser um bairro de outro estado.
"""

from django.db import migrations, models
from django.db.models import F


def geocodificar_de_novo(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    geocodificados = modelo.objects.filter(
        geocodificado_em__isnull=False,
        latitude__isnull=False,
        longitude__isnull=False,
    )
    geocodificados.exclude(estado="").update(
        cidade_geocodificada=F("cidade"), estado_geocodificado=F("estado")
    )
    geocodificados.update(geocodificado_em=None)


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
