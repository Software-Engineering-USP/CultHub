import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { events } from '@/data/events'
import { useEvent, useEventById, useEvents, useSavedEvents } from '@/hooks/useEvents'
import { paths, routes } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import type { ApiEvent, Paginated } from '@/services/catalog'
import { AuthTestProvider } from '../auth'
import { apiEvent } from '../fixtures/catalog'

function routerAt(url: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={routes.event} element={children} />
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  )
}

describe('useEvents', () => {
  it('devolve todos os eventos', () => {
    const { result } = renderHook(() => useEvents())
    expect(result.current).toHaveLength(events.length)
  })
})

describe('useEventById', () => {
  it('acha o evento pelo id e devolve undefined sem id ou com id desconhecido', () => {
    expect(renderHook(() => useEventById('derby-paulista')).result.current?.title).toBe(
      'Derby Paulista: COR x PAL',
    )
    expect(renderHook(() => useEventById(undefined)).result.current).toBeUndefined()
    expect(renderHook(() => useEventById('nao-existe')).result.current).toBeUndefined()
  })
})

describe('useEvent', () => {
  it('lê o evento a partir do :id da rota', () => {
    const { result } = renderHook(() => useEvent(), {
      wrapper: routerAt(paths.event('sp-jazz-blues-festival')),
    })
    expect(result.current?.id).toBe('sp-jazz-blues-festival')
  })

  it('devolve undefined fora de uma rota de evento', () => {
    const { result } = renderHook(() => useEvent(), { wrapper: routerAt(paths.home) })
    expect(result.current).toBeUndefined()
  })
})

describe('useSavedEvents', () => {
  it('carrega todos os eventos salvos pela API, preservando a ordem das páginas', async () => {
    const savedEvents = vi.spyOn(api.agenda, 'savedEvents')
    savedEvents
      .mockResolvedValueOnce({
        count: 2,
        next: '/api/eu/salvos/?page=2',
        previous: null,
        results: [apiEvent({ id: 'evento-1', titulo: 'Primeiro salvo' })],
      })
      .mockResolvedValueOnce({
        count: 2,
        next: null,
        previous: '/api/eu/salvos/',
        results: [apiEvent({ id: 'evento-2', titulo: 'Segundo salvo' })],
      })
    const { result } = renderHook(() => useSavedEvents(), {
      wrapper: ({ children }) => <AuthTestProvider>{children}</AuthTestProvider>,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events.map((event) => event.id)).toEqual(['evento-1', 'evento-2'])
    expect(savedEvents).toHaveBeenNthCalledWith(1, 1)
    expect(savedEvents).toHaveBeenNthCalledWith(2, 2)
  })

  it('não consulta a API quando não há sessão', () => {
    const savedEvents = vi.spyOn(api.agenda, 'savedEvents')
    const { result } = renderHook(() => useSavedEvents(), {
      wrapper: ({ children }) => <AuthTestProvider initialUser={null}>{children}</AuthTestProvider>,
    })

    expect(result.current).toEqual({ events: [], loading: false, error: null })
    expect(savedEvents).not.toHaveBeenCalled()
  })

  it('apresenta o erro retornado ao carregar os eventos salvos', async () => {
    vi.spyOn(api.agenda, 'savedEvents').mockRejectedValue(new ApiError('Sessão expirada.', 403))
    const { result } = renderHook(() => useSavedEvents(), {
      wrapper: ({ children }) => <AuthTestProvider>{children}</AuthTestProvider>,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events).toEqual([])
    expect(result.current.error).toBe('Sessão expirada.')
  })

  it('ignora uma resposta bem-sucedida que chega após desmontar o hook', async () => {
    let resolveRequest!: (response: Paginated<ApiEvent>) => void
    const pending = new Promise<Paginated<ApiEvent>>((resolve) => {
      resolveRequest = resolve
    })
    vi.spyOn(api.agenda, 'savedEvents').mockReturnValue(pending)
    const { unmount } = renderHook(() => useSavedEvents(), {
      wrapper: ({ children }) => <AuthTestProvider>{children}</AuthTestProvider>,
    })

    unmount()
    await act(async () => {
      resolveRequest({ count: 0, next: null, previous: null, results: [] })
      await pending
    })
  })

  it('ignora um erro que chega após desmontar o hook', async () => {
    let rejectRequest!: (error: Error) => void
    const pending = new Promise<Paginated<ApiEvent>>((_, reject) => {
      rejectRequest = reject
    })
    vi.spyOn(api.agenda, 'savedEvents').mockReturnValue(pending)
    const { unmount } = renderHook(() => useSavedEvents(), {
      wrapper: ({ children }) => <AuthTestProvider>{children}</AuthTestProvider>,
    })

    unmount()
    await act(async () => {
      rejectRequest(new Error('Falha de rede.'))
      await pending.catch(() => undefined)
    })
  })
})
