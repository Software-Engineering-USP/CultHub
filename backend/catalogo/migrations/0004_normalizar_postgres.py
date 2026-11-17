from django.db import migrations

# Mesma regra de `catalogo.filtros.normalizar_texto`: minúsculas e sem
# acentos. No SQLite a função é registrada em `catalogo/apps.py`.
CRIAR = r"""
DROP FUNCTION IF EXISTS normalizar(text);
CREATE FUNCTION normalizar(texto text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT regexp_replace(
    normalize(lower(texto), NFKD), '[\u0300-\u036F]', '', 'g'
  )
$$;
"""
REMOVER = "DROP FUNCTION IF EXISTS normalizar(text);"


def criar(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(CRIAR)


def remover(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(REMOVER)


class Migration(migrations.Migration):
    dependencies = [
        ("catalogo", "0003_modelos_evento"),
    ]

    operations = [
        migrations.RunPython(criar, remover),
    ]
