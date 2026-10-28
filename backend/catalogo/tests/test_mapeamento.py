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
        for titulo in ("VIRADA Cultural", "Féstival de Inverno"):
            with self.subTest(titulo=titulo):
                self.assertIn("festival", categorias_do_evento([], titulo))
