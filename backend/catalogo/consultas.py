from catalogo.models import Evento


def eventos_com_relacoes():
    return Evento.objects.select_related("local").prefetch_related(
        "categorias", "imagens", "faixas_preco"
    )
