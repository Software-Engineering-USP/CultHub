from datetime import timedelta

from rest_framework import serializers

from agenda.models import PresencaEmEvento
from catalogo.serializers import EventoSerializer, MarcacoesMixin


class EventoDaAgendaSerializer(MarcacoesMixin, EventoSerializer):
    """Card do evento com as marcações do usuário (inclui removidos)."""

    salvo_em = serializers.DateTimeField(read_only=True, allow_null=True)
    presenca_em = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta(EventoSerializer.Meta):
        fields = (
            *EventoSerializer.Meta.fields,
            "removido",
            "presenca",
            "salvo_em",
            "presenca_em",
        )


class PessoaPresenteSerializer(serializers.ModelSerializer):
    """Quem confirmou presença, sem e-mail nem bairro (como no perfil)."""

    id = serializers.UUIDField(source="usuario.id", read_only=True)
    nome = serializers.CharField(source="usuario.nome", read_only=True)
    iniciais = serializers.CharField(source="usuario.iniciais", read_only=True)

    class Meta:
        model = PresencaEmEvento
        fields = ("id", "nome", "iniciais")


class QuandoSerializer(serializers.Serializer):
    quando = serializers.ChoiceField(choices=("futuras", "passadas"))


class PeriodoSerializer(serializers.Serializer):
    de = serializers.DateField()
    ate = serializers.DateField()

    def validate(self, dados):
        if dados["ate"] < dados["de"]:
            raise serializers.ValidationError(
                {"ate": ["A data final não pode ser anterior à inicial."]}
            )
        if dados["ate"] - dados["de"] > timedelta(days=365):
            raise serializers.ValidationError(
                {"ate": ["O período pode ter no máximo 366 dias."]}
            )
        return dados
