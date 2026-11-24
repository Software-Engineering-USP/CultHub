"""Confere a cidade e a UF dos locais do Ticketmaster na lista do IBGE.

Antes da importação conferir, ficou gravado o que viesse ("Nocity", um
bairro como "Pinheiros", UF "XX"). Mesma regra de `geocodificacao.combinar`
sem resposta do Photon: a cidade passa a ter o nome oficial e só fica se
for da UF (Curitiba/SP fica só SP), a UF que não é estado é apagada (e a
válida nunca é trocada), e a UF nunca é deduzida pelo nome, que pode ser
de um bairro de outro estado: sem UF, fica o nome sem UF. O resto é
apagado. Uma cidade apagada aqui por não ser da UF do Ticketmaster
(Medianeira/PB) volta na próxima importação do local, que grava de novo
o que o Ticketmaster informou. Os locais com
coordenada são conferidos no Photon nas próximas importações (ver
`geocodificacao.pendentes`). Locais cadastrados à mão ficam como estão.
"""

from django.db import migrations

from localidades.municipios import localizar_municipio


def limpar_cidades(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    locais = modelo.objects.filter(
        provedor="ticketmaster", pais__in=("", "BR")
    ).only("cidade", "estado")
    for local in locais:
        cidade, estado = localizar_municipio(
            local.cidade, local.estado, completar_uf=False
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
