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

    async function loadSavedEvents() {
      try {
        const results: EventWithDetails[] = []
        let page = 1
        let hasNextPage = true
        while (hasNextPage) {
          const response = await api.agenda.savedEvents(page)
          results.push(...response.results.map(toCultEvent))
          hasNextPage = Boolean(response.next)
          page += 1
        }
        if (active) setState({ userId, events: results, loading: false, error: null })
      } catch (cause) {
        if (!active) return
        setState({
          userId,
          events: [],
          loading: false,
          error: cause instanceof ApiError ? cause.message : 'Não foi possível carregar seus eventos salvos.',
        })
      }
    }

    void loadSavedEvents()
    return () => {
      active = false
    }
  }, [userId])

  if (!userId) return { events: [], loading: false, error: null }
  if (!state || state.userId !== userId) return { events: [], loading: true, error: null }
  return state
}
