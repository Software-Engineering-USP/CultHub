import logging

PREFIXO = "/api/rotas/"


def _sem_consulta(linha):
    """Linha da requisição sem a query string, se for de /api/rotas/."""
    partes = linha.split(" ")
    if len(partes) != 3:
        return None
    metodo, alvo, protocolo = partes
    caminho = alvo.split("?", 1)[0]
    if not caminho.startswith(PREFIXO) or caminho == alvo:
        return None
    return f"{metodo} {caminho} {protocolo}"


class OcultarConsultaDeRotas(logging.Filter):
    """Tira a query string de /api/rotas/ do log de acesso do runserver.

    A busca e a reversa recebem o endereço digitado e coordenadas, que não
    devem ficar registrados. O registro nunca é descartado: o filtro
    devolve o próprio registro (Python 3.12+), reescrito quando preciso.
    """

    def filter(self, record):
        args = record.args
        if isinstance(args, tuple) and args and isinstance(args[0], str):
            linha = _sem_consulta(args[0])
            if linha is not None:
                record.args = (linha, *args[1:])
        return record


def instalar():
    logger = logging.getLogger("django.server")
    if not any(isinstance(f, OcultarConsultaDeRotas) for f in logger.filters):
        logger.addFilter(OcultarConsultaDeRotas())
