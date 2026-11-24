"""Confere a cidade dos locais do Ticketmaster na lista do IBGE.

Antes da importação conferir a cidade, ficou gravado o que viesse
("Nocity", um bairro como "Pinheiros"). Mesma regra de
`importacao._cidade_e_estado`: a cidade válida passa a ter o nome
oficial, a UF é completada (nunca trocada) quando o nome é de um estado
só, e a cidade de vários estados sem UF fica com o nome apenas se o local
não tiver coordenada. O resto é apagado, e o local com coordenada entra
na geocodificação da próxima importação. Locais cadastrados à mão ficam
como estão.
"""

from django.db import migrations

from localidades.municipios import localizar_municipio


def limpar_cidades(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    locais = (
        modelo.objects.filter(provedor="ticketmaster", pais__in=("", "BR"))
        .exclude(cidade="")
        .only("cidade", "estado", "latitude")
    )
    for local in locais:
        cidade, estado = localizar_municipio(local.cidade, local.estado)
        if cidade and not estado and local.latitude is not None:
            cidade = ""
        estado = estado or local.estado
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
