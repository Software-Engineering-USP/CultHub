import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCatalog, useCatalogEvent } from '@/hooks/useCatalog'
import { catalogApi } from '@/services/catalog'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'

describe('useCatalog', () => {
  afterEach(() => vi.restoreAllMocks())

  it('carrega os resultados e os metadados de paginação', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([apiEvent()], '/api/eventos/?page=2'))
    const { result } = renderHook(() => useCatalog({ q: 'jazz', categorias: ['music'], preco: 'pago' }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events[0].title).toBe('Jazz no Parque')
    expect(result.current.count).toBe(1)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.error).toBeNull()
    expect(catalogApi.events).toHaveBeenCalledWith(
      { q: 'jazz', categorias: ['music'], preco: 'pago', page: 1 },
      expect.any(AbortSignal),
    )
  })

  it('carrega a página seguinte e concatena os resultados sem substituir a página anterior', async () => {
    const events = vi
      .spyOn(catalogApi, 'events')
      .mockResolvedValueOnce(apiPage([apiEvent()], '/api/eventos/?page=2'))
      .mockResolvedValueOnce(apiPage([apiEvent({ id: 'event-2', titulo: 'Teatro' })]))
    const { result } = renderHook(() => useCatalog({}))
    await waitFor(() => expect(result.current.hasMore).toBe(true))

    await act(async () => result.current.loadMore())

    expect(events).toHaveBeenLastCalledWith({ page: 2 }, expect.any(AbortSignal))
    expect(result.current.events.map((event) => event.title)).toEqual(['Jazz no Parque', 'Teatro'])
    expect(result.current.hasMore).toBe(false)
  })

  it('expõe erros de HTTP/rede e mantém a lista vazia', async () => {
    vi.spyOn(catalogApi, 'events').mockRejectedValue(new Error('Servidor indisponível (503)'))
    const { result } = renderHook(() => useCatalog({}))

    await waitFor(() => expect(result.current.error).toBe('Servidor indisponível (503)'))
    expect(result.current.loading).toBe(false)
    expect(result.current.events).toEqual([])
  })

  it('cancela a busca anterior e ignora a resposta antiga quando os filtros mudam', async () => {
    let resolveFirst!: (value: ReturnType<typeof apiPage>) => void
    const events = vi
      .spyOn(catalogApi, 'events')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce(apiPage([apiEvent({ titulo: 'Resultado novo' })]))
    const { result, rerender } = renderHook(({ q }: { q: string }) => useCatalog({ q }), {
      initialProps: { q: 'antigo' },
    })
    await waitFor(() => expect(events).toHaveBeenCalledTimes(1))

    rerender({ q: 'novo' })
    await waitFor(() => expect(result.current.events[0]?.title).toBe('Resultado novo'))
    await act(async () => resolveFirst(apiPage([apiEvent({ titulo: 'Resultado antigo' })])))

    expect(result.current.events[0]?.title).toBe('Resultado novo')
    expect(events.mock.calls[0][1]?.aborted).toBe(true)
  })

  it('não acrescenta uma página antiga depois que os filtros mudam', async () => {
    let resolveSecondPage!: (value: ReturnType<typeof apiPage>) => void
    const events = vi
      .spyOn(catalogApi, 'events')
      .mockResolvedValueOnce(apiPage([apiEvent({ titulo: 'Antigo p1' })], '/api/eventos/?page=2'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondPage = resolve
          }),
      )
      .mockResolvedValueOnce(apiPage([apiEvent({ titulo: 'Novo p1' })]))
    const { result, rerender } = renderHook(({ q }: { q: string }) => useCatalog({ q }), {
      initialProps: { q: 'antigo' },
    })
    await waitFor(() => expect(result.current.hasMore).toBe(true))

    act(() => result.current.loadMore())
    await waitFor(() => expect(events).toHaveBeenCalledTimes(2))
    rerender({ q: 'novo' })
    await waitFor(() => expect(result.current.events[0]?.title).toBe('Novo p1'))
    await act(async () => resolveSecondPage(apiPage([apiEvent({ titulo: 'Antigo p2' })])))

    expect(result.current.events.map((event) => event.title)).toEqual(['Novo p1'])
    expect(events.mock.calls[1][1]?.aborted).toBe(true)
  })
})

describe('useCatalogEvent', () => {
  afterEach(() => vi.restoreAllMocks())

  it('carrega o evento de detalhe pelo identificador', async () => {
    const event = vi.spyOn(catalogApi, 'event').mockResolvedValue(apiEvent())
    const { result } = renderHook(() => useCatalogEvent('6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1'))

    await waitFor(() => expect(result.current.event?.title).toBe('Jazz no Parque'))
    expect(event).toHaveBeenCalledWith('6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1', expect.any(AbortSignal))
    expect(result.current.loading).toBe(false)
  })

  it('trata evento inexistente, falha de rede e id ausente', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new Error('Não encontrado. (404)'))
    const missing = renderHook(() => useCatalogEvent('inexistente'))
    await waitFor(() => expect(missing.result.current.error).toContain('(404)'))
    missing.unmount()

    vi.restoreAllMocks()
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new TypeError('Failed to fetch'))
    const offline = renderHook(() => useCatalogEvent('algum-id'))
    await waitFor(() => expect(offline.result.current.error).toBe('Failed to fetch'))
    offline.unmount()

    const noId = renderHook(() => useCatalogEvent(undefined))
    expect(noId.result.current).toEqual({ loading: false, error: 'Evento não encontrado.' })
  })
})
