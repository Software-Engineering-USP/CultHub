import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { catalogApi, toCultEvent } from '@/services/catalog'
import type { CatalogQuery } from '@/services/catalog'
import type { EventWithDetails } from '@/types'

interface CatalogState {
  events: EventWithDetails[]
  count: number
  loading: boolean
  error: string | null
  hasMore: boolean
  nextPage: number | null
}

export function useCatalog(query: CatalogQuery) {
  const requests = useRef(new Set<AbortController>())
  const queryVersion = useRef(0)
  const categoryKey = query.categorias?.join(',')
  const stableQuery = useMemo<CatalogQuery>(
    () => ({
      q: query.q,
      preco: query.preco,
      categorias: categoryKey ? (categoryKey.split(',') as CatalogQuery['categorias']) : undefined,
    }),
    [categoryKey, query.preco, query.q],
  )
  const [state, setState] = useState<CatalogState>({
    events: [],
    count: 0,
    loading: true,
    error: null,
    hasMore: false,
    nextPage: null,
  })

  const load = useCallback(
    async (page: number, append: boolean, controller: AbortController, version: number) => {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const result = await catalogApi.events({ ...stableQuery, page }, controller.signal)
        if (controller.signal.aborted || version !== queryVersion.current) return
        setState((current) => ({
          events: append
            ? [...current.events, ...result.results.map(toCultEvent)]
            : result.results.map(toCultEvent),
          count: result.count,
          loading: false,
          error: null,
          hasMore: Boolean(result.next),
          nextPage: result.next ? page + 1 : null,
        }))
      } catch (error) {
        if (controller.signal.aborted || version !== queryVersion.current) return
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Não foi possível carregar os eventos.',
        }))
      } finally {
        requests.current.delete(controller)
      }
    },
    [stableQuery],
  )

  useEffect(() => {
    queryVersion.current += 1
    const version = queryVersion.current
    const controller = new AbortController()
    requests.current.add(controller)
    void load(1, false, controller, version)
    return () => {
      requests.current.forEach((request) => request.abort())
      requests.current.clear()
    }
  }, [load])

  const loadMore = useCallback(() => {
    if (!state.loading && state.nextPage !== null) {
      const controller = new AbortController()
      requests.current.add(controller)
      void load(state.nextPage, true, controller, queryVersion.current)
    }
  }, [load, state.nextPage, state.loading])

  return { ...state, loadMore }
}

export function useCatalogEvent(id: string | undefined) {
  const [state, setState] = useState<{
    id?: string
    event?: EventWithDetails
    loading: boolean
    error: Error | null
  }>({ loading: true, error: null })

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    catalogApi
      .event(id, controller.signal)
      .then((event) => setState({ id, event: toCultEvent(event), loading: false, error: null }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            id,
            loading: false,
            error: error instanceof Error ? error : new Error('Não foi possível carregar o evento.'),
          })
        }
      })
    return () => controller.abort()
  }, [id])

  if (!id) return { loading: false, error: new Error('Evento não encontrado.') }
  if (state.id !== id) return { loading: true, error: null }
  return state
}
