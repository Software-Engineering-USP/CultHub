import logging

from django.test import SimpleTestCase

from rotas.logs import OcultarConsultaDeRotas, instalar


def registro(*args):
    return logging.LogRecord(
        "django.server", logging.INFO, __file__, 1, '"%s" %s %s', args, None
    )


class OcultarConsultaDeRotasTest(SimpleTestCase):
    def filtrar(self, registro_):
        self.assertIs(OcultarConsultaDeRotas().filter(registro_), registro_)
        return registro_

    def test_tira_query_string_das_rotas(self):
        linha = (
            "GET /api/rotas/origem/busca/?q=rua+augusta&latitude=-23.55 "
            "HTTP/1.1"
        )

        filtrado = self.filtrar(registro(linha, "200", "312"))

        self.assertEqual(
            filtrado.getMessage(),
            '"GET /api/rotas/origem/busca/ HTTP/1.1" 200 312',
        )

    def test_reversa_tambem(self):
        linha = (
            "GET /api/rotas/origem/reversa/?latitude=-23.5&longitude=-46.6 "
            "HTTP/1.1"
        )

        filtrado = self.filtrar(registro(linha, "200", "312"))

        self.assertEqual(
            filtrado.getMessage(),
            '"GET /api/rotas/origem/reversa/ HTTP/1.1" 200 312',
        )

    def test_linha_mal_formada_com_espaco_na_consulta(self):
        linha = "GET /api/rotas/origem/busca/?q=rua augusta 1500 HTTP/1.1"

        filtrado = self.filtrar(registro(linha, "400", "-"))

        self.assertEqual(
            filtrado.getMessage(),
            '"GET /api/rotas/origem/busca/ HTTP/1.1" 400 -',
        )

    def test_linha_mal_formada_sem_protocolo(self):
        linha = "GET /api/rotas/origem/busca/?q=rua augusta"

        filtrado = self.filtrar(registro(linha, "400", "-"))

        self.assertEqual(
            filtrado.getMessage(), '"GET /api/rotas/origem/busca/" 400 -'
        )

    def test_mensagem_de_erro_do_servidor_tambem(self):
        mensagem = (
            "Bad request syntax ('GET /api/rotas/origem/busca/"
            "?q=rua augusta 1500 HTTP/1.1')"
        )
        registro_ = logging.LogRecord(
            "django.server",
            logging.INFO,
            __file__,
            1,
            "code %d, message %s",
            (400, mensagem),
            None,
        )

        filtrado = self.filtrar(registro_)

        self.assertEqual(
            filtrado.getMessage(),
            "code 400, message Bad request syntax "
            "('GET /api/rotas/origem/busca/ HTTP/1.1')",
        )

    def test_consulta_com_http_no_meio_some_inteira(self):
        linha = "GET /api/rotas/origem/busca/?q=a HTTP/1.1 b HTTP/1.1"

        filtrado = self.filtrar(registro(linha, "400", "-"))

        self.assertEqual(
            filtrado.getMessage(),
            '"GET /api/rotas/origem/busca/ HTTP/1.1" 400 -',
        )

    def test_outras_rotas_ficam_iguais(self):
        linha = "GET /api/eventos/?q=jazz HTTP/1.1"

        filtrado = self.filtrar(registro(linha, "200", "312"))

        self.assertEqual(
            filtrado.getMessage(),
            '"GET /api/eventos/?q=jazz HTTP/1.1" 200 312',
        )

    def test_registro_sem_args_ou_formato_estranho_fica_igual(self):
        casos = [(), ("texto qualquer",), (123, "200", "1")]
        for args in casos:
            with self.subTest(args=args):
                registro_ = logging.LogRecord(
                    "django.server", logging.INFO, __file__, 1, "x", args, None
                )

                self.filtrar(registro_)

                self.assertEqual(registro_.args, args)

    def test_filtro_instalado_no_logger_do_servidor(self):
        filtros = logging.getLogger("django.server").filters

        self.assertEqual(
            sum(isinstance(f, OcultarConsultaDeRotas) for f in filtros), 1
        )

    def test_instalar_de_novo_nao_duplica(self):
        instalar()
        filtros = logging.getLogger("django.server").filters

        self.assertEqual(
            sum(isinstance(f, OcultarConsultaDeRotas) for f in filtros), 1
        )
