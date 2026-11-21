import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import { currentUser } from '@/data/user'
import { useAttendances, useCalendar, useSavedEvents } from '@/hooks/useUserEvents'
import { api, ApiError } from '@/services/api'
import type { AttendanceWhen, ProfileResponse } from '@/services/api'
import type { ApiEvent, Paginated } from '@/services/catalog'
import type { User } from '@/types'
import { AuthTestProvider } from '@tests/auth'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'

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

const wrapper = ({ children }: { children: ReactNode }) => <AuthTestProvider>{children}</AuthTestProvider>

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAttendances e useCalendar', () => {
  it('busca as presenças e volta a buscar quando o filtro muda', async () => {
    const attendances = vi
      .spyOn(api.agenda, 'attendances')
      .mockResolvedValueOnce(apiPage([apiEvent({ id: 'futura', titulo: 'Show futuro' })]))
      .mockResolvedValueOnce(apiPage([apiEvent({ id: 'passada', titulo: 'Show passado' })]))
    const { result, rerender } = renderHook(({ when }) => useAttendances(when), {
      wrapper,
      initialProps: { when: 'futuras' as AttendanceWhen },
    })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.events.map((event) => event.id)).toEqual(['futura']))

    rerender({ when: 'passadas' })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.events.map((event) => event.id)).toEqual(['passada']))
    expect(attendances.mock.calls).toEqual([
      ['futuras', 1],
      ['passadas', 1],
    ])
  })

  it('junta todas as páginas da agenda do período', async () => {
    const calendar = vi
      .spyOn(api.agenda, 'calendar')
      .mockResolvedValueOnce({ ...apiPage([apiEvent({ id: 'p1' })], '/api/eu/agenda/?page=2'), count: 2 })
      .mockResolvedValueOnce(apiPage([apiEvent({ id: 'p2' })]))
    const { result } = renderHook(() => useCalendar('2026-11-01', '2026-11-30'), { wrapper })

    await waitFor(() => expect(result.current.events.map((event) => event.id)).toEqual(['p1', 'p2']))
    expect(calendar.mock.calls).toEqual([
      ['2026-11-01', '2026-11-30', 1],
      ['2026-11-01', '2026-11-30', 2],
    ])
  })

  it('mostra a mensagem do backend ou uma mensagem padrão em caso de erro', async () => {
    vi.spyOn(api.agenda, 'calendar').mockRejectedValue(new ApiError('Período maior que 366 dias.', 400))
    vi.spyOn(api.agenda, 'attendances').mockRejectedValue(new Error('rede'))

    const calendar = renderHook(() => useCalendar('2026-01-01', '2027-12-31'), { wrapper })
    const attendances = renderHook(() => useAttendances('futuras'), { wrapper })

    await waitFor(() => expect(calendar.result.current.error).toBe('Período maior que 366 dias.'))
    await waitFor(() =>
      expect(attendances.result.current.error).toBe('Não foi possível carregar suas presenças.'),
    )
  })

  it('não busca nada para visitantes', () => {
    const attendances = vi.spyOn(api.agenda, 'attendances')
    const { result } = renderHook(() => useAttendances('futuras'), {
      wrapper: ({ children }) => <AuthTestProvider initialUser={null}>{children}</AuthTestProvider>,
    })

    expect(result.current).toEqual({ events: [], loading: false, error: null })
    expect(attendances).not.toHaveBeenCalled()
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
      wrapper,
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
      wrapper,
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
