from rest_framework import serializers

from notificacoes.models import Notificacao


class NotificacaoSerializer(serializers.ModelSerializer):
    evento_id = serializers.UUIDField(read_only=True)
    titulo_evento = serializers.CharField(
        source="evento.titulo", read_only=True
    )
    data_inicio = serializers.DateField(
        source="evento.data_inicio", read_only=True
    )
    hora_inicio = serializers.TimeField(
        source="evento.hora_inicio", read_only=True
    )
    local = serializers.SerializerMethodField()

    class Meta:
        model = Notificacao
        fields = (
            "id",
            "evento_id",
            "titulo_evento",
            "data_inicio",
            "hora_inicio",
            "local",
            "criada_em",
            "lida_em",
        )
        read_only_fields = fields

    def get_local(self, obj):
        if obj.evento.local_id:
            return obj.evento.local.nome
        return "Local a confirmar"
