import { useCallback, useEffect, useState } from 'react'
import { catalogApi, toCultEvent } from '@/services/catalog'
import type { CatalogQuery } from '@/services/catalog'
import type { EventWithDetails } from '@/types'

interface CatalogState {
  events: EventWithDetails[]
  count: number
  loading: boolean
  error: string | null
  hasMore: boolean
}

export function useCatalog(query: CatalogQuery) {
  const [state, setState] = useState<CatalogState>({
    events: [],
    count: 0,
    loading: true,
    error: null,
    hasMore: false,
  })

  const load = useCallback(async (page = 1, append = false, signal?: AbortSignal) => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const result = await catalogApi.events({ ...query, page }, signal)
      if (signal?.aborted) return
      setState((current) => ({
        events: append ? [...current.events, ...result.results.map(toCultEvent)] : result.results.map(toCultEvent),
        count: result.count,
        loading: false,
        error: null,
        hasMore: Boolean(result.next),
      }))
    } catch (error) {
      if (signal?.aborted) return
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'Não foi possível carregar os eventos.',
      }))
    }
  }, [query.q, query.preco, query.categorias?.join(',')])

  useEffect(() => {
    const controller = new AbortController()
    void load(1, false, controller.signal)
    return () => controller.abort()
  }, [load])

  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) void load(Math.floor(state.events.length / 20) + 1, true)
  }, [load, state.events.length, state.hasMore, state.loading])

  return { ...state, loadMore }
}

export function useCatalogEvent(id: string | undefined) {
  const [state, setState] = useState<{ event?: EventWithDetails; loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ loading: false, error: 'Evento não encontrado.' })
      return
    }
    const controller = new AbortController()
    setState({ loading: true, error: null })
    catalogApi.event(id, controller.signal)
      .then((event) => setState({ event: toCultEvent(event), loading: false, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ loading: false, error: error instanceof Error ? error.message : 'Não foi possível carregar o evento.' })
        }
      })
    return () => controller.abort()
  }, [id])

  return state
}

