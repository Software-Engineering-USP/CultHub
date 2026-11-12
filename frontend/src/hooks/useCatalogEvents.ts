import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarEventos } from '@/services/catalog'
import type { CultEvent } from '@/types'

export function useCatalogEvents() {
  const [events, setEvents] = useState<CultEvent[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const applyPage = useCallback(
    (pageToLoad: number, append: boolean, result: Awaited<ReturnType<typeof buscarEventos>>) => {
      setEvents((current) => (append ? [...current, ...result.events] : result.events))
      setCount(result.count)
      setPage(pageToLoad)
      setHasMore(result.hasMore)
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    requestRef.current = controller

    void buscarEventos(1, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) applyPage(1, false, result)
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Ocorreu um erro ao carregar os eventos.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [applyPage])

  const loadPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setLoading(true)
      setError(null)

      try {
        const result = await buscarEventos(pageToLoad, controller.signal)
        if (!controller.signal.aborted) applyPage(pageToLoad, append, result)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Ocorreu um erro ao carregar os eventos.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    [applyPage],
  )

  const retry = useCallback(() => void loadPage(1, false), [loadPage])
  const loadMore = useCallback(() => {
    if (!loading && hasMore) void loadPage(page + 1, true)
  }, [hasMore, loadPage, loading, page])

  return { events, count, hasMore, loading, error, retry, loadMore }
}
