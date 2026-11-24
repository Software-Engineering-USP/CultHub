"""Estados e municípios do Brasil, pela lista oficial do IBGE.

`dados/municipios.json` vem da API de localidades do IBGE
(`servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado`,
baixada em 24/11/2026), reduzida a sigla → nome do estado e sigla →
nomes dos municípios. Os nomes são os oficiais, os mesmos que o
OpenStreetMap (e portanto o Photon) usa.

As migrações de dados `usuarios.0003` e `catalogo.0007` usam
`estados`, `municipio_oficial`, `ufs_com_municipio` e
`localizar_municipio`: mudar o que elas devolvem muda o que essas
migrações fazem num banco novo.
"""

import json
import unicodedata
from functools import cache
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parent / "dados" / "municipios.json"

# Apóstrofos que o celular ou outra fonte põe no lugar do ' do IBGE
# ("Dias d’Ávila").
APOSTROFOS = str.maketrans(dict.fromkeys("’‘ʼ`´", "'"))


def _chave(texto):
    """Texto para comparar nomes: sem caixa, acento e espaços repetidos.

    Não usa `catalogo.filtros.normalizar_texto` de propósito: as migrações
    de dados dependem deste módulo, que não pode puxar o resto do app.
    """
    # Antes do NFKD, que transforma o "´" solto em espaço + acento.
    texto = texto.translate(APOSTROFOS).casefold()
    decomposto = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in decomposto if not unicodedata.combining(c))
    return " ".join(sem_acento.split())


@cache
def _dados():
    with ARQUIVO.open(encoding="utf-8") as arquivo:
        dados = json.load(arquivo)
    indice = {
        uf: {_chave(nome): nome for nome in nomes}
        for uf, nomes in dados["municipios"].items()
    }
    por_nome_do_estado = {
        _chave(nome): uf for uf, nome in dados["estados"].items()
    }
    return dados, indice, por_nome_do_estado


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

    Ignora caixa, acentos, espaços repetidos e o tipo de apóstrofo:
    ("sao  paulo", "sp") dá "São Paulo".
    """
    if not isinstance(nome, str) or not isinstance(uf, str):
        return ""
    return _dados()[1].get(uf.upper(), {}).get(_chave(nome), "")


def ufs_com_municipio(nome):
    """Siglas das UFs que têm um município com esse nome."""
    chave = _chave(nome)
    return [uf for uf, nomes in _dados()[1].items() if chave in nomes]


def localizar_municipio(nome, uf):
    """(nome oficial, UF) da cidade, corrigindo ou completando a UF.

    - Município da UF informada: fica como está.
    - Nome que só existe em um estado: vale esse estado, mesmo que a UF
      informada seja outra ("Medianeira", "PB" dá ("Medianeira", "PR")).
    - Nome de vários estados e sem UF: o nome oficial, que é o mesmo em
      todos, com a UF vazia ("Bom Jesus", "").
    - O resto (nome que não existe, ou de vários estados e nenhum deles o
      informado): ("", UF informada).
    """
    uf = uf.strip().upper() if isinstance(uf, str) else ""
    if not isinstance(nome, str):
        return "", uf
    if oficial := municipio_oficial(nome, uf):
        return oficial, uf
    candidatas = ufs_com_municipio(nome)
    if len(candidatas) == 1 or (candidatas and not uf):
        unica = candidatas[0] if len(candidatas) == 1 else ""
        return municipio_oficial(nome, candidatas[0]), unica
    return "", uf
