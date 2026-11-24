"""Guarda o que o Ticketmaster informou, para combinar com o Photon.

Antes, a cidade do Ticketmaster era conferida com a UF dele e gravada em
`cidade`, e a geocodificação recombinava a partir daí: a cidade que não
era da UF do Ticketmaster, mas era da UF da coordenada, já tinha sumido.
Agora a entrada fica em `cidade_informada`/`estado_informado`, e
`cidade`/`estado` são só o resultado de `geocodificacao.combinar`.

Para os locais que já existem, a melhor informação disponível é a
cidade/UF de hoje, que pode ter vindo do Photon (Medianeira/PR, quando o
Ticketmaster diz PB): ela vira a entrada do Ticketmaster e, nos locais
com coordenada ainda sem resposta guardada, também a resposta provisória
do Photon. Todo local do Ticketmaster com coordenada volta para a fila
(agora todos são conferidos uma vez, não só os sem cidade). Até a nova
consulta, a importação combina os dados novos do Ticketmaster com essa
resposta provisória, então a cidade/UF de hoje não se perde se o Photon
estiver fora ou o local ficar além do limite da fila.
"""

from django.db import migrations, models
from django.db.models import F


def copiar_e_geocodificar_de_novo(apps, schema_editor):
    modelo = apps.get_model("catalogo", "Local")
    do_ticketmaster = modelo.objects.filter(provedor="ticketmaster")
    do_ticketmaster.update(
        cidade_informada=F("cidade"), estado_informado=F("estado")
    )
    com_coordenada = do_ticketmaster.filter(
        latitude__isnull=False, longitude__isnull=False
    )
    com_coordenada.filter(
        cidade_geocodificada="", estado_geocodificado=""
    ).update(
        cidade_geocodificada=F("cidade"), estado_geocodificado=F("estado")
    )
    com_coordenada.update(geocodificado_em=None)


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
