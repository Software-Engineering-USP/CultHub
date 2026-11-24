"""Apaga a cidade dos locais do Ticketmaster que não é município do IBGE.

Antes da importação conferir a cidade, ficou gravado o que viesse
("Nocity"). Sem cidade, o local entra na geocodificação da próxima
importação. A cidade válida passa a ter o nome oficial. Locais cadastrados
à mão ficam como estão.
"""

from django.db import migrations

from localidades.municipios import municipio_oficial


def limpar_cidades(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    locais = (
        modelo.objects.filter(provedor="ticketmaster", pais__in=("", "BR"))
        .exclude(cidade="")
        .only("cidade", "estado")
    )
    for local in locais:
        oficial = municipio_oficial(local.cidade, local.estado)
        if oficial != local.cidade:
            modelo.objects.filter(pk=local.pk).update(cidade=oficial)


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0006_local_geocodificado_em")]

    operations = [
        migrations.RunPython(
            limpar_cidades, migrations.RunPython.noop, elidable=True
        ),
    ]
