"""Confere a cidade e a UF dos locais do Ticketmaster na lista do IBGE.

Antes da importação conferir, ficou gravado o que viesse ("Nocity", um
bairro como "Pinheiros", UF "XX"). Mesma regra de
`importacao._cidade_e_estado`: a cidade válida passa a ter o nome
oficial, a UF que não é estado é apagada (e a válida nunca é trocada), e
sem UF a cidade só a completa se o local não tiver coordenada. O resto é
apagado. O local com coordenada e sem cidade ou UF entra na
geocodificação da próxima importação, com a cidade que sobrou como
palpite. Locais cadastrados à mão ficam como estão.
"""

from django.db import migrations

from localidades.municipios import localizar_municipio


def limpar_cidades(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    locais = modelo.objects.filter(
        provedor="ticketmaster", pais__in=("", "BR")
    ).only("cidade", "estado", "latitude", "longitude")
    for local in locais:
        cidade, estado = localizar_municipio(
            local.cidade,
            local.estado,
            completar_uf=local.latitude is None or local.longitude is None,
        )
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
