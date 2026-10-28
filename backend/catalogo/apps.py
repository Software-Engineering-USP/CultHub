from django.apps import AppConfig
from django.db.backends.signals import connection_created


def registrar_normalizar(sender, connection, **kwargs):
    """Registra `normalizar` no SQLite (que só ignora caixa em ASCII)."""
    if connection.vendor != "sqlite":
        return
    from catalogo.filtros import normalizar_texto

    connection.connection.create_function(
        "normalizar",
        1,
        lambda t: None if t is None else normalizar_texto(t),
        deterministic=True,
    )


class CatalogoConfig(AppConfig):
    name = "catalogo"

    def ready(self):
        connection_created.connect(
            registrar_normalizar, dispatch_uid="catalogo.normalizar"
        )
