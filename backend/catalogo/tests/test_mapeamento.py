import json
from pathlib import Path

from django.test import SimpleTestCase

from catalogo.mapeamento import categorias_do_evento, genero_do_evento

FIXTURE = Path(__file__).parent / "dados" / "ticketmaster_pagina.json"


def _evento(id_):
    dados = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for evento in dados["_embedded"]["events"]:
        if evento["id"] == id_:
            return evento
    raise KeyError(id_)


def _resultado(id_):
    evento = _evento(id_)
    classificacoes = evento["classifications"]
    return (
        categorias_do_evento(classificacoes, evento["name"]),
        genero_do_evento(classificacoes),
    )


def _classificacao(segmento, genero=None):
    classificacao = {"segment": {"name": segmento}}
    if genero:
        classificacao["genre"] = {"name": genero}
    return classificacao


class MapeamentoTests(SimpleTestCase):
    def test_bts_musica(self):
        cats, genero = _resultado("ZFIMVHtnMZ17kfjN")
        self.assertEqual(cats, {"music"})
        self.assertEqual(genero, "Pop")

    def test_sampa_sky_artes(self):
        cats, genero = _resultado("ZFIMVHtnMZ17a3j6")
        self.assertEqual(cats, {"art"})
        self.assertEqual(genero, "Fine Art")

    def test_comedia_teatro(self):
        cats, genero = _resultado("ZFIMVHtnMZ17adCZ")
        self.assertEqual(cats, {"theater"})
        self.assertEqual(genero, "Comedy")

    def test_fairs_festivals(self):
        cats, _ = _resultado("ZFIMVHtnMZ17FFe9")
        self.assertEqual(cats, {"festival"})

    def test_lollapalooza(self):
        cats, genero = _resultado("ZFIMVHtnMZ17kKvo")
        self.assertEqual(cats, {"music", "festival"})
        self.assertEqual(genero, "")

    def test_rolex_esportes(self):
        cats, _ = _resultado("ZFIMVHtnMZ17Ft06")
        self.assertEqual(cats, {"sport"})

    def test_halloween_sem_categoria(self):
        cats, genero = _resultado("ZFIMVHtnMZ17aa4-")
        self.assertEqual(cats, set())
        self.assertEqual(genero, "")

    def test_film_vira_artes(self):
        classificacoes = [
            {"primary": True, "segment": {"name": "Film"}},
        ]
        self.assertEqual(categorias_do_evento(classificacoes, "Cine"), {"art"})

    def test_festival_pelo_titulo_sem_acento_e_caixa(self):
        for titulo in (
            "VIRADA Cultural",
            "Féstival de Inverno",
            "The Town 2027",
            "Rock in Rio",
            "LOLLAPALOOZA",
        ):
            with self.subTest(titulo=titulo):
                self.assertEqual(
                    categorias_do_evento([], titulo), {"festival"}
                )

    def test_generos_de_teatro(self):
        for genero in (
            "Theatre",
            "Comedy",
            "Musical",
            "Opera",
            "Children's Theatre",
            "Magic & Illusion",
            "Circus & Specialty Acts",
        ):
            with self.subTest(genero=genero):
                self.assertEqual(
                    categorias_do_evento(
                        [_classificacao("Arts & Theatre", genero)], "X"
                    ),
                    {"theater"},
                )

    def test_outro_genero_de_artes_vira_art(self):
        self.assertEqual(
            categorias_do_evento(
                [_classificacao("Arts & Theatre", "Fine Art")], "X"
            ),
            {"art"},
        )

    def test_genero_de_festival_em_qualquer_segmento(self):
        self.assertEqual(
            categorias_do_evento(
                [_classificacao("Miscellaneous", "Fairs & Festivals")], "X"
            ),
            {"festival"},
        )

    def test_considera_todas_as_classificacoes(self):
        self.assertEqual(
            categorias_do_evento(
                [_classificacao("Music"), _classificacao("Sports")], "X"
            ),
            {"music", "sport"},
        )

    def test_classificacao_sem_segmento_nao_quebra(self):
        self.assertEqual(
            categorias_do_evento([{"segment": None, "genre": None}], "X"),
            set(),
        )

    def test_genero_vem_da_classificacao_principal(self):
        classificacoes = [
            _classificacao("Music", "Rock"),
            {**_classificacao("Music", "Jazz"), "primary": True},
        ]
        self.assertEqual(genero_do_evento(classificacoes), "Jazz")

    def test_sem_principal_usa_a_primeira(self):
        classificacoes = [
            _classificacao("Music", "Rock"),
            _classificacao("Music", "Jazz"),
        ]
        self.assertEqual(genero_do_evento(classificacoes), "Rock")

    def test_genero_indefinido_usa_o_subgenero(self):
        classificacao = {
            **_classificacao("Music", "Undefined"),
            "subGenre": {"name": "Bossa Nova"},
        }
        self.assertEqual(genero_do_evento([classificacao]), "Bossa Nova")

    def test_genero_e_subgenero_indefinidos_ficam_vazios(self):
        classificacao = {
            **_classificacao("Music", "Undefined"),
            "subGenre": {"name": "Undefined"},
        }
        self.assertEqual(genero_do_evento([classificacao]), "")

    def test_sem_classificacao_fica_sem_genero(self):
        self.assertEqual(genero_do_evento([]), "")
