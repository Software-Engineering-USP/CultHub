import type { ApiComment, ApiMyComment } from '@/services/api'
import type { EventComment, MyComment } from '@/types'

export function toEventComment(comment: ApiComment): EventComment {
  return {
    id: comment.id,
    eventId: comment.evento,
    parentId: comment.resposta_a,
    level: comment.nivel,
    author: comment.autor && {
      id: comment.autor.id,
      name: comment.autor.nome,
      initials: comment.autor.iniciais,
    },
    text: comment.texto,
    createdAt: comment.criado_em,
    editedAt: comment.editado_em,
    removed: comment.removido,
    mine: comment.meu,
    replies: comment.respostas.map(toEventComment),
  }
}

export function toMyComment(comment: ApiMyComment): MyComment {
  return {
    id: comment.id,
    event: { id: comment.evento.id, title: comment.evento.titulo },
    parentId: comment.resposta_a,
    level: comment.nivel,
    text: comment.texto,
    createdAt: comment.criado_em,
    editedAt: comment.editado_em,
  }
}

/** Data curta do comentário, ex.: "16 de nov. de 2026, 14:30". */
export function formatCommentDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}
