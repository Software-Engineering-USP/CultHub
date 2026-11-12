import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { events } from '@/data/events'
import { useEvent, useEventById, useEvents, useSavedEvents } from '@/hooks/useEvents'
import { paths, routes } from '@/lib/paths'
import { api } from '@/services/api'
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
})
