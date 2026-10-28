"""Mapeamento das classificações do Ticketmaster para as categorias do app."""

import unicodedata

# Segmento -> categoria (quando o segmento basta).
CATEGORIA_POR_SEGMENTO = {
    "Music": "music",
    "Sports": "sport",
    "Film": "art",
}

# Dentro de "Arts & Theatre": gêneros de teatro; os demais viram "art".
GENEROS_DE_TEATRO = {
    "Theatre",
    "Comedy",
    "Musical",
    "Opera",
    "Children's Theatre",
    "Magic & Illusion",
    "Circus & Specialty Acts",
}

# Gênero que vira festival em qualquer segmento.
GENERO_FESTIVAL = "Fairs & Festivals"

# Palavras no título que também marcam festival (sem caixa/acento).
PALAVRAS_FESTIVAL = (
    "festival",
    "lollapalooza",
    "the town",
    "rock in rio",
    "virada",
)


def _normalizar(texto):
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.casefold()


def _nome(classificacao, chave):
    return (classificacao.get(chave) or {}).get("name") or ""


def categorias_do_evento(classificacoes, titulo):
    """Códigos de CategoriaCultural do evento (todas as classificações)."""
    categorias = set()
    for classificacao in classificacoes:
        segmento = _nome(classificacao, "segment")
        genero = _nome(classificacao, "genre")
        if segmento == "Arts & Theatre":
            if genero in GENEROS_DE_TEATRO:
                categorias.add("theater")
            else:
                categorias.add("art")
        elif segmento in CATEGORIA_POR_SEGMENTO:
            categorias.add(CATEGORIA_POR_SEGMENTO[segmento])
        if genero == GENERO_FESTIVAL:
            categorias.add("festival")
    titulo_normalizado = _normalizar(titulo)
    if any(p in titulo_normalizado for p in PALAVRAS_FESTIVAL):
        categorias.add("festival")
    return categorias


def genero_do_evento(classificacoes):
    """Gênero (ou subgênero) da classificação principal; "" se indefinido."""
    if not classificacoes:
        return ""
    principal = next(
        (c for c in classificacoes if c.get("primary")), classificacoes[0]
    )
    for chave in ("genre", "subGenre"):
        nome = _nome(principal, chave)
        if nome and nome != "Undefined":
            return nome
    return ""
