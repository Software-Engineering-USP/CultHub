import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api, ApiError } from '@/services/api'
import { toAttendee } from '@/services/users'
import type { Attendee } from '@/types'

interface AttendeesState {
  requestKey: string
  attendees: Attendee[]
  nextPage: number | null
  error: string | null
}

export interface AttendeesResult {
  attendees: Attendee[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
}

const LOAD_ERROR = 'Não foi possível carregar quem vai ao evento.'

function errorText(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : LOAD_ERROR
}

function nextPageOf(next: string | null, page: number): number | null {
  return next ? page + 1 : null
}

/**
 * Quem confirmou presença no evento, paginado; vazio (sem buscar nada) para visitantes.
 * Quando `version` muda (ex.: o usuário marcou presença), recarrega desde a primeira página.
 */
export function useAttendees(eventId: string, version: number | string = 0): AttendeesResult {
  const userId = useCurrentUser()?.id
  const requestKey = `${userId}|${eventId}|${version}`
  const [state, setState] = useState<AttendeesState | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!userId) return
    const key = `${userId}|${eventId}|${version}`
    let active = true
    api.agenda
      .attendees(eventId, 1)
      .then((page) => {
        if (!active) return
        setState({
          requestKey: key,
          attendees: page.results.map(toAttendee),
          nextPage: nextPageOf(page.next, 1),
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (active) setState({ requestKey: key, attendees: [], nextPage: null, error: errorText(cause) })
      })
    return () => {
      active = false
    }
  }, [userId, eventId, version])

  const current = userId && state?.requestKey === requestKey ? state : null

  const loadMore = useCallback(async () => {
    if (!current?.nextPage) return
    const page = current.nextPage
    setLoadingMore(true)
    try {
      const result = await api.agenda.attendees(eventId, page)
      const known = new Set(current.attendees.map((attendee) => attendee.id))
      setState((previous) =>
        previous?.requestKey === current.requestKey
          ? {
              ...previous,
              // Confirmações novas empurram as antigas para a página seguinte; não repete quem já aparece.
              attendees: [
                ...previous.attendees,
                ...result.results.map(toAttendee).filter((attendee) => !known.has(attendee.id)),
              ],
              nextPage: nextPageOf(result.next, page),
              error: null,
            }
          : previous,
      )
    } catch (cause) {
      setState((previous) =>
        previous?.requestKey === current.requestKey ? { ...previous, error: errorText(cause) } : previous,
      )
    } finally {
      setLoadingMore(false)
    }
  }, [current, eventId])

  return {
    attendees: current?.attendees ?? [],
    loading: Boolean(userId) && !current,
    loadingMore,
    error: current?.error ?? null,
    hasMore: Boolean(current?.nextPage),
    loadMore,
  }
}
