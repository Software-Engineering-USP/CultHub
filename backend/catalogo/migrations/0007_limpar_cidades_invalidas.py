"""Confere a cidade dos locais do Ticketmaster na lista do IBGE.

Antes da importação conferir a cidade, ficou gravado o que viesse
("Nocity"). A cidade válida passa a ter o nome oficial, e a UF é corrigida
ou completada quando o nome só existe em um estado (ver
`localizar_municipio`); a que não dá para reconhecer é apagada, e o local
entra na geocodificação da próxima importação se tiver coordenada.
Locais cadastrados à mão ficam como estão.
"""

from django.db import migrations

from localidades.municipios import localizar_municipio


def limpar_cidades(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    locais = (
        modelo.objects.filter(provedor="ticketmaster", pais__in=("", "BR"))
        .exclude(cidade="")
        .only("cidade", "estado")
    )
    for local in locais:
        cidade, estado = localizar_municipio(local.cidade, local.estado)
        if (cidade, estado) != (local.cidade, local.estado):
            modelo.objects.filter(pk=local.pk).update(
                cidade=cidade, estado=estado
            )


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0006_local_geocodificado_em")]

    operations = [
        migrations.RunPython(
            limpar_cidades, migrations.RunPython.noop, elidable=True
        ),
    ]
