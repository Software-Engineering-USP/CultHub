from datetime import date

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from catalogo.models import CategoriaCultural
from localidades.municipios import estados
from usuarios.models import Usuario, conferir_localidade


class PerfilSerializer(serializers.ModelSerializer):
    """Dados do próprio usuário (tela "Minha conta")."""

    preferencias = serializers.SlugRelatedField(
        many=True,
        slug_field="codigo",
        queryset=CategoriaCultural.objects.all(),
    )
    # Texto, e não a escolha do modelo, para aceitar "sp" (ver
    # `validate_estado`).
    estado = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = (
            "id",
            "nome",
            "email",
            "cidade",
            "estado",
            "bairro",
            "preferencias",
            "iniciais",
        )
        read_only_fields = ("id", "email")

    def validate_estado(self, estado):
        """Sigla em maiúsculas ("sp" vira "SP"); "" limpa o estado."""
        estado = estado.strip().upper()
        if estado and estado not in estados():
            raise serializers.ValidationError("Escolha um estado da lista.")
        return estado

    def validate(self, dados):
        """A cidade precisa ser um município do estado escolhido.

        Grava o nome oficial do IBGE ("sao paulo" vira "São Paulo"), que é
        o mesmo dos locais dos eventos (ver `conferir_localidade`).
        """
        if "cidade" not in dados and "estado" not in dados:
            return dados
        cidade = dados.get("cidade", getattr(self.instance, "cidade", ""))
        estado = dados.get("estado", getattr(self.instance, "estado", ""))
        try:
            dados["cidade"] = conferir_localidade(cidade, estado)
        except DjangoValidationError as erro:
            raise serializers.ValidationError(erro.message_dict) from None
        return dados


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
            "estado",
            "preferencias",
            "membro_desde",
        )
        read_only_fields = fields

    def get_membro_desde(self, usuario) -> date:
        # Só o dia: a hora exata do cadastro não interessa a mais ninguém.
        return timezone.localdate(usuario.criado_em)


def campo_senha():
    """Senha como foi digitada: o padrão do DRF apara os espaços das pontas."""
    return serializers.CharField(write_only=True, trim_whitespace=False)


EMAIL_JA_EXISTE = "Já existe uma conta com este e-mail."


class CadastroSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150)
    # O mesmo limite da coluna: acima dele o Postgres recusava com erro 500.
    email = serializers.EmailField(
        max_length=Usuario._meta.get_field("email").max_length
    )
    senha = campo_senha()
    aceite_termos = serializers.BooleanField()

    def validate_email(self, email):
        email = Usuario.normalize_username(email)
        if Usuario.objects.filter(email=email).exists():
            raise serializers.ValidationError(EMAIL_JA_EXISTE)
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
        # Dois cadastros simultâneos passam pela checagem acima; o segundo
        # esbarra no e-mail único do banco e recebe o mesmo erro do campo.
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
                {"email": [EMAIL_JA_EXISTE]}
            ) from None


class EntrarSerializer(serializers.Serializer):
    email = serializers.EmailField()
    senha = campo_senha()
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
    senha = campo_senha()

    def validate_senha(self, senha):
        validate_password(senha)
        return senha
