from rest_framework import serializers

from catalogo.models import CategoriaCultural


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaCultural
        fields = ("codigo", "nome")
