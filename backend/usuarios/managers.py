from django.contrib.auth.base_user import BaseUserManager


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **campos):
        if not email or not email.strip():
            raise ValueError("O e-mail é obrigatório.")
        usuario = self.model(email=email.strip().lower(), **campos)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    # `password` (e não `senha`): nome usado pelo `createsuperuser` do Django
    def create_superuser(self, email, password=None, **campos):
        campos.setdefault("is_staff", True)
        campos.setdefault("is_superuser", True)
        return self.create_user(email, password, **campos)
