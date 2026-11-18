import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api, ApiError } from '@/services/api'
import { toEventComment, toMyComment } from '@/services/comments'
import type { EventComment, MyComment } from '@/types'

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback
}

/** Aplica `change` ao comentário `id` em qualquer nível da árvore (null tira ele da árvore). */
function changeInTree(
  comments: EventComment[],
  id: string,
  change: (comment: EventComment) => EventComment | null,
): EventComment[] {
  return comments.flatMap((comment) => {
    if (comment.id === id) {
      const changed = change(comment)
      return changed ? [changed] : []
    }
    if (!comment.replies.length) return [comment]
    return [{ ...comment, replies: changeInTree(comment.replies, id, change) }]
  })
}

/** Como no backend: removido só continua na lista enquanto tiver alguma resposta. */
function withoutEmptyRemoved(comments: EventComment[]): EventComment[] {
  return comments.flatMap((comment) => {
    const replies = withoutEmptyRemoved(comment.replies)
    if (comment.removed && !replies.length) return []
    return [{ ...comment, replies }]
  })
}

function nextPageOf(next: string | null, page: number): number | null {
  return next ? page + 1 : null
}

interface EventCommentsState {
  eventId: string
  comments: EventComment[]
  /** Total de comentários (de primeiro nível) visíveis no evento. */
  count: number
  nextPage: number | null
  error: string | null
}

export interface EventCommentsResult {
  comments: EventComment[]
  count: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  /** As ações abaixo lançam ApiError; quem chama mostra a mensagem. */
  create: (text: string) => Promise<void>
  reply: (commentId: string, text: string) => Promise<void>
  update: (commentId: string, text: string) => Promise<void>
  remove: (commentId: string) => Promise<void>
}

const LOAD_ERROR = 'Não foi possível carregar os comentários.'

/** Comentários de um evento, paginados, com criar, responder, editar e remover. */
export function useComments(eventId: string | undefined): EventCommentsResult {
  const [state, setState] = useState<EventCommentsState | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!eventId) return
    let active = true
    api.comments
      .list(eventId, 1)
      .then((page) => {
        if (!active) return
        setState({
          eventId,
          comments: page.results.map(toEventComment),
          count: page.count,
          nextPage: nextPageOf(page.next, 1),
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (active)
          setState({ eventId, comments: [], count: 0, nextPage: null, error: errorText(cause, LOAD_ERROR) })
      })
    return () => {
      active = false
    }
  }, [eventId])

  const current = eventId && state?.eventId === eventId ? state : null

  /** Atualiza a árvore e ajusta o total pelos comentários de primeiro nível que entraram ou saíram. */
  const updateComments = useCallback((change: (comments: EventComment[]) => EventComment[]) => {
    setState((previous) => {
      if (!previous) return previous
      const comments = change(previous.comments)
      return { ...previous, comments, count: previous.count + comments.length - previous.comments.length }
    })
  }, [])

  const loadMore = useCallback(async () => {
    if (!current?.nextPage) return
    const page = current.nextPage
    setLoadingMore(true)
    try {
      const result = await api.comments.list(current.eventId, page)
      const known = new Set(current.comments.map((comment) => comment.id))
      setState((previous) =>
        previous && previous.eventId === current.eventId
          ? {
              ...previous,
              // Comentários novos empurram os antigos para a página seguinte; não repete os já vistos.
              comments: [
                ...previous.comments,
                ...result.results.map(toEventComment).filter((comment) => !known.has(comment.id)),
              ],
              count: result.count,
              nextPage: nextPageOf(result.next, page),
            }
          : previous,
      )
    } catch (cause) {
      setState((previous) => previous && { ...previous, error: errorText(cause, LOAD_ERROR) })
    } finally {
      setLoadingMore(false)
    }
  }, [current])

  const create = useCallback(
    async (text: string) => {
      if (!eventId) return
      const created = toEventComment(await api.comments.create(eventId, text))
      updateComments((comments) => [created, ...comments])
    },
    [eventId, updateComments],
  )

  const reply = useCallback(
    async (commentId: string, text: string) => {
      const created = toEventComment(await api.comments.reply(commentId, text))
      updateComments((comments) =>
        changeInTree(comments, commentId, (parent) => ({ ...parent, replies: [...parent.replies, created] })),
      )
    },
    [updateComments],
  )

  const update = useCallback(
    async (commentId: string, text: string) => {
      const updated = toEventComment(await api.comments.update(commentId, text))
      // A resposta do PATCH traz as respostas também; mantém as que já estão na tela.
      updateComments((comments) =>
        changeInTree(comments, commentId, (comment) => ({ ...updated, replies: comment.replies })),
      )
    },
    [updateComments],
  )

  const remove = useCallback(
    async (commentId: string) => {
      await api.comments.remove(commentId)
      updateComments((comments) =>
        withoutEmptyRemoved(
          changeInTree(comments, commentId, (comment) => ({
            ...comment,
            author: null,
            text: null,
            removed: true,
            mine: false,
          })),
        ),
      )
    },
    [updateComments],
  )

  return {
    comments: current?.comments ?? [],
    count: current?.count ?? 0,
    loading: Boolean(eventId) && !current,
    loadingMore,
    error: current?.error ?? null,
    hasMore: Boolean(current?.nextPage),
    loadMore,
    create,
    reply,
    update,
    remove,
  }
}

export interface UserCommentsResult {
  comments: MyComment[]
  loading: boolean
  error: string | null
  /** As ações lançam ApiError; quem chama mostra a mensagem. */
  update: (commentId: string, text: string) => Promise<void>
  remove: (commentId: string) => Promise<void>
}

/** A primeira página informa o total; as demais são buscadas em paralelo. */
async function fetchAllMyComments(): Promise<MyComment[]> {
  const firstPage = await api.comments.mine(1)
  const pageCount = firstPage.next ? Math.ceil(firstPage.count / firstPage.results.length) : 1
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => api.comments.mine(index + 2)),
  )
  return [firstPage, ...remainingPages].flatMap((page) => page.results.map(toMyComment))
}

/** Comentários e respostas do usuário logado; vazio (sem buscar nada) para visitantes. */
export function useUserComments(): UserCommentsResult {
  const userId = useCurrentUser()?.id
  const [state, setState] = useState<{ userId: string; comments: MyComment[]; error: string | null } | null>(
    null,
  )

  useEffect(() => {
    if (!userId) return
    let active = true
    fetchAllMyComments()
      .then((comments) => {
        if (active) setState({ userId, comments, error: null })
      })
      .catch((cause: unknown) => {
        if (active)
          setState({
            userId,
            comments: [],
            error: errorText(cause, 'Não foi possível carregar seus comentários.'),
          })
      })
    return () => {
      active = false
    }
  }, [userId])

  const update = useCallback(async (commentId: string, text: string) => {
    const updated = await api.comments.update(commentId, text)
    setState(
      (previous) =>
        previous && {
          ...previous,
          comments: previous.comments.map((comment) =>
            comment.id === commentId
              ? { ...comment, text: updated.texto ?? text, editedAt: updated.editado_em }
              : comment,
          ),
        },
    )
  }, [])

  const remove = useCallback(async (commentId: string) => {
    await api.comments.remove(commentId)
    setState(
      (previous) =>
        previous && {
          ...previous,
          comments: previous.comments.filter((comment) => comment.id !== commentId),
        },
    )
  }, [])

  if (!userId) return { comments: [], loading: false, error: null, update, remove }
  if (state?.userId !== userId) return { comments: [], loading: true, error: null, update, remove }
  return { comments: state.comments, loading: false, error: state.error, update, remove }
}
