from datetime import date

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
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


class PerfilPublicoSerializer(serializers.ModelSerializer):
    """O que outra pessoa logada vê de um usuário.

    Fica de fora o que identifica ou localiza demais: e-mail e bairro.
    """

    preferencias = serializers.SlugRelatedField(
        many=True, slug_field="codigo", read_only=True
    )
    membro_desde = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = (
            "id",
            "nome",
            "iniciais",
            "cidade",
            "preferencias",
            "membro_desde",
        )
        read_only_fields = fields

    def get_membro_desde(self, usuario) -> date:
        # Só o dia: a hora exata do cadastro não interessa a mais ninguém.
        return timezone.localdate(usuario.criado_em)


class CadastroSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)
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
