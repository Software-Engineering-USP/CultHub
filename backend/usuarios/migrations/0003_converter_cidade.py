"""Converte a cidade em texto livre em município do IBGE + estado.

Até aqui a cidade do perfil era digitada ("São Paulo, SP", "São Paulo -
SP", "sampa"...). Fica o que dá para reconhecer na lista do IBGE; o resto
fica em branco e a pessoa escolhe de novo em Minha conta (ver
`localidade`).
"""

import re
import unicodedata

from django.db import migrations

from localidades.municipios import estados, localizar_municipio


def normalizar_texto(texto):
    """Cópia fixa de `catalogo.filtros.normalizar_texto` (sem acento/caixa)."""
    decomposto = unicodedata.normalize("NFKD", texto.casefold())
    return "".join(c for c in decomposto if not unicodedata.combining(c))


def _cidade_e_uf(texto):
    """("sao paulo", "sp") a partir de "São Paulo, SP"; a UF é opcional.

    Cópia da leitura que as notificações faziam do texto livre: aceita
    "Cidade, UF", "Cidade - UF", "Cidade-UF", "Cidade – UF", "Cidade/UF" e
    "Cidade UF". Uma sigla isolada ("SP") é só a UF.
    """
    ufs = {uf.casefold() for uf in estados()}
    partes = [
        parte.strip()
        for parte in re.split(r"[,/]", normalizar_texto(texto))
        if parte.strip()
    ]
    if not partes:
        return "", ""
    # Espaço, hífen ou travessão só separam uma UF no fim, para não
    # quebrar cidades como "Embu-Guaçu".
    ultima = partes[-1]
    resto = ultima[:-2]
    cidade = resto.rstrip(" \t-–—")
    if ultima[-2:] in ufs and cidade and cidade != resto:
        partes[-1:] = [cidade, ultima[-2:]]
    if len(partes) == 1 and partes[0] in ufs:
        return "", partes[0]
    uf = partes[-1] if len(partes) > 1 and partes[-1] in ufs else ""
    return partes[0], uf


def localidade(texto):
    """(município oficial, UF) do texto antigo; o que faltar fica "".

    Mesma regra dos locais (`localizar_municipio`): com UF, a cidade
    precisa ser dela ("Medianeira, PB" dá ("", "PB")); sem UF, a cidade de
    um estado só ganha a UF ("Curitiba" fica no PR), e a de vários fica
    com o nome oficial e sem UF ("Bom Jesus"): os avisos filtram pela
    cidade, e Minha conta pede o estado quando a pessoa salvar de novo.
    """
    cidade, uf = _cidade_e_uf(texto)
    if not cidade:
        return "", uf.upper()
    return localizar_municipio(cidade, uf)


def converter_cidades(apps, schema_editor):
    modelo = apps.get_model("usuarios", "Usuario")
    for usuario in modelo.objects.exclude(cidade="").only("cidade"):
        cidade, estado = localidade(usuario.cidade)
        modelo.objects.filter(pk=usuario.pk).update(
            cidade=cidade, estado=estado
        )


class Migration(migrations.Migration):
    dependencies = [("usuarios", "0002_usuario_estado")]

    operations = [
        migrations.RunPython(
            converter_cidades, migrations.RunPython.noop, elidable=True
        ),
    ]
