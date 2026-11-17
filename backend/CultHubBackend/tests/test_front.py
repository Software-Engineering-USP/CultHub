import tempfile
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase, override_settings


class PaginaDoFrontTest(SimpleTestCase):
    def setUp(self):
        pasta = tempfile.TemporaryDirectory()
        self.addCleanup(pasta.cleanup)
        self.dist = Path(pasta.name)
        (self.dist / "index.html").write_text(
            "<div id='root'></div>", encoding="utf-8"
        )

    def test_rota_do_react_recebe_o_index_sem_cache(self):
        with override_settings(FRONTEND_DIST=self.dist):
            for caminho in ("/", "/conta", "/eventos/123/rota"):
                with self.subTest(caminho=caminho):
                    resposta = self.client.get(caminho)
                    self.assertEqual(resposta.status_code, 200)
                    self.assertEqual(resposta["Cache-Control"], "no-cache")
                    self.assertIn(b"id='root'", resposta.getvalue())

    def test_api_e_arquivo_inexistentes_continuam_404(self):
        with override_settings(FRONTEND_DIST=self.dist):
            for caminho in ("/api/nao-existe/", "/assets/antigo-abc123.js"):
                with self.subTest(caminho=caminho):
                    resposta = self.client.get(caminho)
                    self.assertEqual(resposta.status_code, 404)

    def test_admin_sem_barra_redireciona_para_o_admin(self):
        with override_settings(FRONTEND_DIST=self.dist):
            resposta = self.client.get("/admin")
        self.assertRedirects(
            resposta, "/admin/", status_code=301, target_status_code=302
        )

    def test_sem_front_buildado_responde_404(self):
        with override_settings(FRONTEND_DIST=None):
            resposta = self.client.get("/conta")
        self.assertEqual(resposta.status_code, 404)

    def test_so_aceita_leitura(self):
        with override_settings(FRONTEND_DIST=self.dist):
            resposta = self.client.post("/conta")
        self.assertEqual(resposta.status_code, 405)


class ArquivoImutavelTest(SimpleTestCase):
    def test_so_os_arquivos_com_hash_do_vite_sao_imutaveis(self):
        imutavel = settings.WHITENOISE_IMMUTABLE_FILE_TEST
        self.assertTrue(imutavel("x", "/assets/index-abc123.js"))
        self.assertFalse(imutavel("x", "/favicon.svg"))
        self.assertFalse(imutavel("x", "/index.html"))
