from rest_framework.pagination import PageNumberPagination


class PaginacaoEventos(PageNumberPagination):
    page_size = 20
    page_size_query_param = "tamanho"
    max_page_size = 200
