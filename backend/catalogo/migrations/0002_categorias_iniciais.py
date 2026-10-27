from django.db import migrations

# As 5 categorias das telas do Figma; `codigo` igual ao CategoryId do front
CATEGORIAS = [
    ("music", "Música"),
    ("festival", "Festivais"),
    ("theater", "Teatro"),
    ("sport", "Esportes"),
    ("art", "Artes"),
]


def criar_categorias(apps, schema_editor):
    CategoriaCultural = apps.get_model("catalogo", "CategoriaCultural")
    for codigo, nome in CATEGORIAS:
        CategoriaCultural.objects.get_or_create(
            codigo=codigo, defaults={"nome": nome}
        )


def apagar_categorias(apps, schema_editor):
    CategoriaCultural = apps.get_model("catalogo", "CategoriaCultural")
    CategoriaCultural.objects.filter(
        codigo__in=[codigo for codigo, _ in CATEGORIAS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalogo", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(criar_categorias, apagar_categorias),
    ]
