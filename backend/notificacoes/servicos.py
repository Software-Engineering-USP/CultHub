"""Criação das notificações de evento novo, depois da importação."""

import re
from collections import defaultdict

from django.contrib.auth import get_user_model
from django.utils import timezone

from catalogo.filtros import normalizar_texto, visiveis
from catalogo.models import Evento
from notificacoes.models import Notificacao, TipoNotificacao

# Uma importação pode trazer dezenas de eventos: cada pessoa recebe no
# máximo este tanto por execução, começando pelos que acontecem antes.
LIMITE_POR_USUARIO = 5


def _cidade_e_uf(texto):
    """("sao paulo", "sp") a partir de "São Paulo, SP"; a UF é opcional.

    A cidade do perfil é texto livre: aceita "Cidade, UF", "Cidade - UF"
    e "Cidade/UF", sem caixa nem acento.
    """
    partes = [
        parte.strip()
        for parte in re.split(r",|/| - ", normalizar_texto(texto))
        if parte.strip()
    ]
    if not partes:
        return "", ""
    uf = partes[-1] if len(partes) > 1 and len(partes[-1]) == 2 else ""
    return partes[0], uf


def _interessados_por_categoria(categorias):
    """Categoria -> [(usuário, cidade, UF)] de quem a escolheu."""
    por_categoria = defaultdict(list)
    linhas = (
        get_user_model()
        .objects.filter(is_active=True, preferencias__in=categorias)
        .values_list("pk", "cidade", "preferencias")
    )
    for usuario_id, cidade, categoria_id in linhas:
        por_categoria[categoria_id].append((usuario_id, *_cidade_e_uf(cidade)))
    return por_categoria


def _mesma_regiao(cidade, uf, local):
    """Se o evento é da região de quem informou a cidade no perfil.

    O Ticketmaster quase nunca manda a cidade do local, só o estado. Sem
    a cidade do evento, vale o estado; sem nenhum dos dois, não há como
    excluir e o aviso é enviado.
    """
    if not cidade:
        return True
    cidade_evento = normalizar_texto(local.cidade.strip()) if local else ""
    if cidade_evento:
        return cidade == cidade_evento
    uf_evento = local.estado.casefold() if local else ""
    return not (uf and uf_evento) or uf == uf_evento


def _destinatarios(evento, por_categoria):
    """Quem recebe o aviso deste evento (cada pessoa uma vez só)."""
    return {
        usuario_id
        for categoria in evento.categorias.all()
        for usuario_id, cidade, uf in por_categoria.get(categoria.pk, ())
        if _mesma_regiao(cidade, uf, evento.local)
    }


def _montar(eventos, por_categoria, ja_avisados):
    """Notificações a criar, respeitando o limite por pessoa.

    Pares (usuário, evento) já avisados ficam de fora antes do limite,
    para não gastarem as vagas dos eventos que ainda não foram avisados.
    """
    recebidas = defaultdict(int)
    novas = []
    for evento in eventos:
        for usuario_id in _destinatarios(evento, por_categoria):
            if (usuario_id, evento.pk) in ja_avisados:
                continue
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

    Quem preencheu a cidade no perfil só recebe eventos de lá (ver
    `_mesma_regiao`); quem não escolheu nenhuma preferência não recebe
    nada. Devolve quantas notificações foram criadas.
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
    # Repetir a chamada para os mesmos eventos não duplica nem conta de novo.
    ja_avisados = set(
        Notificacao.objects.filter(
            tipo=TipoNotificacao.EVENTO_NOVO, evento__in=eventos
        ).values_list("usuario_id", "evento_id")
    )
    novas = _montar(
        eventos, _interessados_por_categoria(categorias), ja_avisados
    )
    # `ignore_conflicts`: uma importação sobreposta não pode levantar
    # IntegrityError, que desfaria a importação inteira junto.
    Notificacao.objects.bulk_create(novas, ignore_conflicts=True)
    return len(novas)
