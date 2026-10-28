from rest_framework import serializers

from catalogo.models import (
    CategoriaCultural,
    Evento,
    FaixaPreco,
    ImagemEvento,
    Local,
)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaCultural
        fields = ("codigo", "nome")


class LocalSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    class Meta:
        model = Local
        fields = (
            "nome",
            "endereco",
            "cidade",
            "estado",
            "latitude",
            "longitude",
        )


class FaixaPrecoSerializer(serializers.ModelSerializer):
    minimo = serializers.FloatField()
    maximo = serializers.FloatField()

    class Meta:
        model = FaixaPreco
        fields = ("tipo", "moeda", "minimo", "maximo")


class ImagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImagemEvento
        fields = ("url", "proporcao", "largura", "altura")


def _chave_imagem(imagem):
    # Não-fallback primeiro, depois maior largura; larguras nulas por último.
    return (
        imagem.fallback,
        imagem.largura is None,
        -(imagem.largura or 0),
    )


class EventoSerializer(serializers.ModelSerializer):
    categorias = serializers.SlugRelatedField(
        many=True, read_only=True, slug_field="codigo"
    )
    local = LocalSerializer(read_only=True)
    faixas_preco = FaixaPrecoSerializer(many=True, read_only=True)
    imagens = serializers.SerializerMethodField()
    distancia_km = serializers.SerializerMethodField()

    class Meta:
        model = Evento
        fields = (
            "id",
            "provedor",
            "titulo",
            "descricao",
            "genero",
            "categorias",
            "url_externa",
            "data_inicio",
            "hora_inicio",
            "inicio",
            "data_fim",
            "hora_fim",
            "fim",
            "fuso",
            "local",
            "gratuito",
            "faixas_preco",
            "imagens",
            "distancia_km",
        )

    def get_imagens(self, obj) -> list[dict]:
        # `all()` usa o prefetch; ordena em Python para não refazer a query.
        imagens = sorted(obj.imagens.all(), key=_chave_imagem)
        return ImagemSerializer(imagens, many=True).data

    def get_distancia_km(self, obj) -> float | None:
        distancia = getattr(obj, "distancia_km", None)
        return None if distancia is None else round(distancia, 1)


class EventoDetalheSerializer(EventoSerializer):
    removido = serializers.SerializerMethodField()

    class Meta(EventoSerializer.Meta):
        fields = (
            *EventoSerializer.Meta.fields,
            "avisos",
            "situacao",
            "removido",
        )

    def get_removido(self, obj) -> bool:
        return obj.removido_em is not None
