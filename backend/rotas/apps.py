from django.apps import AppConfig


class RotasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "rotas"

    def ready(self):
        from rotas.logs import instalar

        instalar()
