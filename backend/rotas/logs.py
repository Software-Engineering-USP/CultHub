import logging
import re

# Caminho de /api/rotas/ seguido da query string. A query vai até o último
# " HTTP/" (o protocolo, que fica) ou até o fim; assim também cobre linhas
# mal formadas, com espaço sem codificar no endereço.
CONSULTA_DE_ROTAS = re.compile(
    r"(/api/rotas/[^?\s]*)\?(?:.*(?= HTTP/)|.*)", re.DOTALL
)


def _sem_consulta(texto):
    return CONSULTA_DE_ROTAS.sub(r"\1", texto)


class OcultarConsultaDeRotas(logging.Filter):
    """Tira a query string de /api/rotas/ do log de acesso do runserver.

    A busca e a reversa recebem o endereço digitado e coordenadas, que não
    devem ficar registrados. Vale para todo argumento de texto: a linha do
    log de acesso e a mensagem de erro de requisição mal formada. O
    registro nunca é descartado: o filtro devolve o próprio registro
    (Python 3.12+), reescrito quando preciso.
    """

    def filter(self, record):
        if isinstance(record.args, tuple):
            record.args = tuple(
                _sem_consulta(arg) if isinstance(arg, str) else arg
                for arg in record.args
            )
        return record


def instalar():
    logger = logging.getLogger("django.server")
    if not any(isinstance(f, OcultarConsultaDeRotas) for f in logger.filters):
        logger.addFilter(OcultarConsultaDeRotas())
