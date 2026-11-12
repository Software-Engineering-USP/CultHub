import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import { events } from '@/data/events'
import { currentUser } from '@/data/user'
import { useEvent, useEventById, useEvents, useSavedEvents } from '@/hooks/useEvents'
import { paths, routes } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import type { ApiEvent, Paginated } from '@/services/catalog'
import type { User } from '@/types'
import { AuthTestProvider } from '../auth'
import { apiEvent } from '../fixtures/catalog'

const switchProfile: ProfileResponse = {
  id: 'second-user',
  nome: 'Outra Pessoa',
  email: 'outra.pessoa@exemplo.com',
  cidade: '',
  bairro: '',
  preferencias: [],
  iniciais: 'OP',
}

function SwitchableAuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(currentUser)
  const value = {
    user,
    loading: false,
    signUp: async () => switchProfile,
    signIn: async () => switchProfile,
    signOut: async () => setUser(null),
    updateUser: () => setUser({ ...currentUser, id: switchProfile.id }),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <button type="button" onClick={() => setUser({ ...currentUser, id: switchProfile.id })}>
        Mudar sessão
      </button>
    </AuthContext.Provider>
  )
}

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
    expect(savedEvents).toHaveBeenNthCalledWith(1)
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

  it('ignora os resultados da sessão anterior após trocar de usuário', async () => {
    let resolvePrevious!: (response: Paginated<ApiEvent>) => void
    let resolveCurrent!: (response: Paginated<ApiEvent>) => void
    const previousRequest = new Promise<Paginated<ApiEvent>>((resolve) => {
      resolvePrevious = resolve
    })
    const currentRequest = new Promise<Paginated<ApiEvent>>((resolve) => {
      resolveCurrent = resolve
    })
    const savedEvents = vi
      .spyOn(api.agenda, 'savedEvents')
      .mockReturnValueOnce(previousRequest)
      .mockReturnValueOnce(currentRequest)
    const { result } = renderHook(() => useSavedEvents(), { wrapper: SwitchableAuthProvider })

    fireEvent.click(screen.getByRole('button', { name: 'Mudar sessão' }))
    expect(savedEvents).toHaveBeenCalledTimes(2)

    await act(async () => {
      resolvePrevious({
        count: 1,
        next: null,
        previous: null,
        results: [apiEvent({ id: 'evento-da-sessao-antiga' })],
      })
      await previousRequest
    })
    expect(result.current).toEqual({ events: [], loading: true, error: null })

    await act(async () => {
      resolveCurrent({
        count: 1,
        next: null,
        previous: null,
        results: [apiEvent({ id: 'evento-da-sessao-atual' })],
      })
      await currentRequest
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.events.map((event) => event.id)).toEqual(['evento-da-sessao-atual'])
  })
})
