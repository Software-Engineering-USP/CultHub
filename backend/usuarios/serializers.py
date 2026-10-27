from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from catalogo.models import CategoriaCultural
from usuarios.models import Usuario


def normalizar_email(email):
    return email.strip().lower()


class PerfilSerializer(serializers.ModelSerializer):
    """Dados do próprio usuário (tela "Minha conta")."""

    preferencias = serializers.SlugRelatedField(
        many=True,
        slug_field="codigo",
        queryset=CategoriaCultural.objects.all(),
    )
    iniciais = serializers.ReadOnlyField()

    class Meta:
        model = Usuario
        fields = (
            "id",
            "nome",
            "email",
            "cidade",
            "bairro",
            "preferencias",
            "iniciais",
        )
        read_only_fields = ("id", "email")


class CadastroSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)
    aceite_termos = serializers.BooleanField()

    def validate_email(self, email):
        email = normalizar_email(email)
        if Usuario.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "Já existe uma conta com este e-mail."
            )
        return email

    def validate_senha(self, senha):
        validate_password(senha)
        return senha

    def validate_aceite_termos(self, aceite):
        if not aceite:
            raise serializers.ValidationError(
                "É preciso aceitar os Termos de uso e a Política de "
                "privacidade."
            )
        return aceite

    def create(self, dados):
        return Usuario.objects.create_user(
            dados["email"],
            dados["senha"],
            nome=dados["nome"],
            termos_aceitos_em=timezone.now(),
        )


class EntrarSerializer(serializers.Serializer):
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)
    lembrar = serializers.BooleanField(default=False)

    def validate(self, dados):
        usuario = authenticate(
            self.context.get("request"),
            username=normalizar_email(dados["email"]),
            password=dados["senha"],
        )
        if usuario is None:
            raise serializers.ValidationError("E-mail ou senha inválidos.")
        dados["usuario"] = usuario
        return dados
