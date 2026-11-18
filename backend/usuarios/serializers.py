from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from catalogo.models import CategoriaCultural
from usuarios.models import Usuario


class PerfilSerializer(serializers.ModelSerializer):
    """Dados do próprio usuário (tela "Minha conta")."""

    preferencias = serializers.SlugRelatedField(
        many=True,
        slug_field="codigo",
        queryset=CategoriaCultural.objects.all(),
    )

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
    email = serializers.EmailField(max_length=254)
    senha = serializers.CharField(write_only=True, trim_whitespace=False)
    aceite_termos = serializers.BooleanField()

    def validate_email(self, email):
        email = Usuario.normalize_username(email)
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
        try:
            with transaction.atomic():
                return Usuario.objects.create_user(
                    dados["email"],
                    dados["senha"],
                    nome=dados["nome"],
                    termos_aceitos_em=timezone.now(),
                )
        except IntegrityError:
            raise serializers.ValidationError(
                {"email": ["Já existe uma conta com este e-mail."]}
            ) from None


class EntrarSerializer(serializers.Serializer):
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True, trim_whitespace=False)
    lembrar = serializers.BooleanField(default=False)

    def validate(self, dados):
        usuario = authenticate(
            self.context.get("request"),
            username=Usuario.normalize_username(dados["email"]),
            password=dados["senha"],
        )
        if usuario is None:
            raise serializers.ValidationError("E-mail ou senha inválidos.")
        dados["usuario"] = usuario
        return dados


class RecuperarSenhaSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, email):
        return Usuario.normalize_username(email)


class RedefinirSenhaSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    senha = serializers.CharField(write_only=True)

    def validate_senha(self, senha):
        validate_password(senha)
        return senha
