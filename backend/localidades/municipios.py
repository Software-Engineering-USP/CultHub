"""Estados e municípios do Brasil, pela lista oficial do IBGE.

`dados/municipios.json` vem da API de localidades do IBGE
(`servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado`,
baixada em 24/11/2026), reduzida a sigla → nome do estado e sigla →
nomes dos municípios. Os nomes são os oficiais, os mesmos que o
OpenStreetMap (e portanto o Photon) usa.
"""

import json
from functools import cache
from pathlib import Path

from catalogo.filtros import normalizar_texto

ARQUIVO = Path(__file__).resolve().parent / "dados" / "municipios.json"


@cache
def _dados():
    with ARQUIVO.open(encoding="utf-8") as arquivo:
        dados = json.load(arquivo)
    indice = {
        uf: {normalizar_texto(nome): nome for nome in nomes}
        for uf, nomes in dados["municipios"].items()
    }
    por_nome_do_estado = {
        normalizar_texto(nome): uf for uf, nome in dados["estados"].items()
    }
    return dados, indice, por_nome_do_estado


def _chave(texto):
    return " ".join(normalizar_texto(texto).split())


def estados():
    """Sigla → nome dos 27 estados (com o DF), em ordem de sigla."""
    return _dados()[0]["estados"]


def municipios_da_uf(uf):
    """Nomes oficiais dos municípios da UF, em ordem alfabética."""
    return _dados()[0]["municipios"].get(uf.upper(), [])


def sigla_do_estado(texto):
    """Sigla do estado a partir da sigla ou do nome ("sp", "São Paulo").

    Devolve "" quando o texto não é um estado.
    """
    if not isinstance(texto, str):
        return ""
    chave = _chave(texto)
    if chave.upper() in estados():
        return chave.upper()
    return _dados()[2].get(chave, "")


def municipio_oficial(nome, uf):
    """Nome oficial do município `nome` da UF, ou "" se não existir lá.

    Ignora caixa, acentos e espaços repetidos: ("sao  paulo", "sp") dá
    "São Paulo".
    """
    if not isinstance(nome, str) or not isinstance(uf, str):
        return ""
    return _dados()[1].get(uf.upper(), {}).get(_chave(nome), "")


def ufs_com_municipio(nome):
    """Siglas das UFs que têm um município com esse nome."""
    chave = _chave(nome)
    return [uf for uf, nomes in _dados()[1].items() if chave in nomes]
