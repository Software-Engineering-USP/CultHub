import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { events, findEvent } from '@/data/events'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { toCultEvent } from '@/services/catalog'
import { api, ApiError } from '@/services/api'
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
  const [savedEvents, setSavedEvents] = useState<EventWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setSavedEvents([])
      setError(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

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
        if (active) setSavedEvents(results)
      } catch (cause) {
        if (!active) return
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Não foi possível carregar seus eventos salvos.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSavedEvents()
    return () => {
      active = false
    }
  }, [user])

  return { events: savedEvents, loading, error }
}
