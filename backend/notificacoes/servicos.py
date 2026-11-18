"""Criação das notificações de evento novo, depois da importação."""

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.utils import timezone

from catalogo.filtros import normalizar_texto, visiveis
from catalogo.models import Evento
from notificacoes.models import Notificacao, TipoNotificacao

# Uma importação pode trazer dezenas de eventos: cada pessoa recebe no
# máximo este tanto por execução, começando pelos que acontecem antes.
LIMITE_POR_USUARIO = 5


def _cidade(texto):
    """Só o nome da cidade, sem caixa nem acento ("São Paulo, SP")."""
    return normalizar_texto(texto.split(",")[0].strip())


def _interessados_por_categoria(categorias):
    """Categoria -> [(usuário, cidade do perfil)] de quem a escolheu."""
    por_categoria = defaultdict(list)
    linhas = (
        get_user_model()
        .objects.filter(is_active=True, preferencias__in=categorias)
        .values_list("pk", "cidade", "preferencias")
    )
    for usuario_id, cidade, categoria_id in linhas:
        por_categoria[categoria_id].append((usuario_id, _cidade(cidade)))
    return por_categoria


def _destinatarios(evento, por_categoria):
    """Quem recebe o aviso deste evento (cada pessoa uma vez só)."""
    cidade_evento = _cidade(evento.local.cidade) if evento.local else ""
    return {
        usuario_id
        for categoria in evento.categorias.all()
        for usuario_id, cidade in por_categoria.get(categoria.pk, ())
        if not cidade or cidade == cidade_evento
    }


def _montar(eventos, por_categoria):
    """Notificações a criar, respeitando o limite por pessoa."""
    recebidas = defaultdict(int)
    novas = []
    for evento in eventos:
        for usuario_id in _destinatarios(evento, por_categoria):
            if recebidas[usuario_id] >= LIMITE_POR_USUARIO:
                continue
            recebidas[usuario_id] += 1
            novas.append(
                Notificacao(
                    usuario_id=usuario_id,
                    evento=evento,
                    tipo=TipoNotificacao.EVENTO_NOVO,
                )
            )
    return novas


def notificar_eventos_novos(ids_eventos):
    """Avisa quem tem a categoria do evento nas preferências.

    Quem preencheu a cidade no perfil só recebe eventos dessa cidade; quem
    não escolheu nenhuma preferência não recebe nada. Devolve quantas
    notificações foram criadas.
    """
    if not ids_eventos:
        return 0
    eventos = list(
        visiveis(Evento.objects.filter(pk__in=ids_eventos), timezone.now())
        .select_related("local")
        .prefetch_related("categorias")
        .order_by("data_inicio", "hora_inicio", "titulo", "pk")
    )
    categorias = {
        categoria.pk
        for evento in eventos
        for categoria in evento.categorias.all()
    }
    if not categorias:
        return 0
    novas = _montar(eventos, _interessados_por_categoria(categorias))
    eventos_novos = Notificacao.objects.filter(
        tipo=TipoNotificacao.EVENTO_NOVO
    )
    antes = eventos_novos.count()
    Notificacao.objects.bulk_create(novas, ignore_conflicts=True)
    return eventos_novos.count() - antes
