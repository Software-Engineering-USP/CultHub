from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.http import require_safe


@require_safe
def pagina_do_front(request):
    """Entrega o `index.html` do front; o React resolve a rota no navegador."""
    if settings.FRONTEND_DIST is None:
        raise Http404
    try:
        index = (settings.FRONTEND_DIST / "index.html").open("rb")
    except FileNotFoundError:
        # Build quebrado ou FRONTEND_DIST apontando para a pasta errada.
        raise Http404 from None
    resposta = FileResponse(index, content_type="text/html; charset=utf-8")
    # O index aponta para arquivos com hash no nome: não pode ficar em cache.
    resposta["Cache-Control"] = "no-cache"
    return resposta
