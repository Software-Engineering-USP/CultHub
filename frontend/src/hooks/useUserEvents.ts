import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api, ApiError } from '@/services/api'
import type { AttendanceWhen } from '@/services/api'
import { toCultEvent } from '@/services/catalog'
import type { ApiEvent, Paginated } from '@/services/catalog'
import type { EventWithDetails } from '@/types'

/** Listas de eventos do usuário logado (salvos, presenças e agenda do período). */
export type UserEventsQuery =
  | { list: 'saved' }
  | { list: 'attendances'; when: AttendanceWhen }
  | { list: 'calendar'; from: string; to: string }

export interface UserEventsResult {
  events: EventWithDetails[]
  loading: boolean
  error: string | null
}

const errorMessages: Record<UserEventsQuery['list'], string> = {
  saved: 'Não foi possível carregar seus eventos salvos.',
  attendances: 'Não foi possível carregar suas presenças.',
  calendar: 'Não foi possível carregar sua agenda.',
}

type PageLoader = (page: number) => Promise<Paginated<ApiEvent>>

function pageLoader(query: UserEventsQuery): PageLoader {
  switch (query.list) {
    case 'saved':
      return (page) => api.agenda.savedEvents(page)
    case 'attendances':
      return (page) => api.agenda.attendances(query.when, page)
    case 'calendar':
      return (page) => api.agenda.calendar(query.from, query.to, page)
  }
}

/** A primeira página informa o total; as demais são buscadas em paralelo. */
async function fetchAllPages(loadPage: PageLoader) {
  const firstPage = await loadPage(1)
  const pageCount = firstPage.next ? Math.ceil(firstPage.count / firstPage.results.length) : 1
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => loadPage(index + 2)),
  )
  return [firstPage, ...remainingPages].flatMap((page) => page.results.map(toCultEvent))
}

/** Uma das listas do usuário logado; vazia (sem buscar nada) para visitantes. */
export function useUserEvents(query: UserEventsQuery): UserEventsResult {
  const userId = useCurrentUser()?.id
  // A consulta vira texto para o efeito só rodar de novo quando ela mudar de verdade.
  const key = JSON.stringify(query)
  const [state, setState] = useState<{
    requestKey: string
    events: EventWithDetails[]
    error: string | null
  } | null>(null)

  useEffect(() => {
    if (!userId) return
    const requestKey = `${userId}|${key}`
    const currentQuery = JSON.parse(key) as UserEventsQuery
    let active = true

    fetchAllPages(pageLoader(currentQuery))
      .then((events) => {
        if (active) setState({ requestKey, events, error: null })
      })
      .catch((cause: unknown) => {
        if (!active) return
        const error = cause instanceof ApiError ? cause.message : errorMessages[currentQuery.list]
        setState({ requestKey, events: [], error })
      })

    return () => {
      active = false
    }
  }, [userId, key])

  if (!userId) return { events: [], loading: false, error: null }
  if (state?.requestKey !== `${userId}|${key}`) return { events: [], loading: true, error: null }
  return { events: state.events, loading: false, error: state.error }
}

/** Do salvo mais recente para o mais antigo. */
export function useSavedEvents(): UserEventsResult {
  return useUserEvents({ list: 'saved' })
}

export function useAttendances(when: AttendanceWhen): UserEventsResult {
  return useUserEvents({ list: 'attendances', when })
}

/** Datas no formato AAAA-MM-DD. */
export function useCalendar(from: string, to: string): UserEventsResult {
  return useUserEvents({ list: 'calendar', from, to })
}
