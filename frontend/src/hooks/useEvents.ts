import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { events, findEvent } from '@/data/events'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api, ApiError } from '@/services/api'
import { toCultEvent } from '@/services/catalog'
import type { CultEvent, EventWithDetails } from '@/types'

/** Todos os eventos. */
export function useEvents(): CultEvent[] {
  return events
}

/** Um evento pelo id, se existir. */
export function useEventById(id: string | undefined): CultEvent | undefined {
  return id ? findEvent(id) : undefined
}

/** Evento da rota atual (/eventos/:id/...), se existir. */
export function useEvent(): CultEvent | undefined {
  const { id } = useParams()
  return useEventById(id)
}

/** Eventos salvos pelo usuário atual, na ordem em que foram salvos. */
export function useSavedEvents(): {
  events: EventWithDetails[]
  loading: boolean
  error: string | null
} {
  const user = useCurrentUser()
  const userId = user?.id
  const [state, setState] = useState<{
    userId: string
    events: EventWithDetails[]
    loading: boolean
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!userId) return

    let active = true

    async function loadSavedEvents(activeUserId: string) {
      try {
        const firstPage = await api.agenda.savedEvents()
        const pageCount = firstPage.next ? Math.ceil(firstPage.count / firstPage.results.length) : 1
        const remainingPages = await Promise.all(
          Array.from({ length: pageCount - 1 }, (_, index) => api.agenda.savedEvents(index + 2)),
        )
        const results = [firstPage, ...remainingPages].flatMap((page) => page.results.map(toCultEvent))
        if (active) {
          setState({ userId: activeUserId, events: results, loading: false, error: null })
        }
      } catch (cause) {
        if (!active) return
        setState({
          userId: activeUserId,
          events: [],
          loading: false,
          error: cause instanceof ApiError ? cause.message : 'Não foi possível carregar seus eventos salvos.',
        })
      }
    }

    void loadSavedEvents(userId)
    return () => {
      active = false
    }
  }, [userId])

  if (!userId) return { events: [], loading: false, error: null }
  if (!state || state.userId !== userId) return { events: [], loading: true, error: null }
  return state
}
