import logging

PREFIXO = "/api/rotas/"


class OcultarConsultaDeRotas(logging.Filter):
    """Tira a query string de /api/rotas/ do log de acesso do runserver.

    A busca e a reversa recebem o endereço digitado e coordenadas, que não
    devem ficar registrados. O registro nunca é descartado, só reescrito.
    """

    def filter(self, record):
        args = record.args
        if not isinstance(args, tuple) or not args:
            return True
        if not isinstance(args[0], str):
            return True
        partes = args[0].split(" ")
        if len(partes) != 3:
            return True
        metodo, alvo, protocolo = partes
        caminho = alvo.split("?", 1)[0]
        if caminho.startswith(PREFIXO) and caminho != alvo:
            record.args = (f"{metodo} {caminho} {protocolo}", *args[1:])
        return True


def instalar():
    logger = logging.getLogger("django.server")
    if not any(isinstance(f, OcultarConsultaDeRotas) for f in logger.filters):
        logger.addFilter(OcultarConsultaDeRotas())
