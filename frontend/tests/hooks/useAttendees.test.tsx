import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAttendees } from '@/hooks/useAttendees'
import { api, ApiError } from '@/services/api'
import type { ApiAttendee } from '@/services/api'
import type { Paginated } from '@/services/catalog'
import { AuthTestProvider } from '@tests/auth'
import { apiAttendee } from '@tests/fixtures/attendees'
import { commentPage as page } from '@tests/fixtures/comments'

const EVENT_ID = 'sp-jazz-blues-festival'
const loggedIn = ({ children }: { children: ReactNode }) => <AuthTestProvider>{children}</AuthTestProvider>
const loggedOut = ({ children }: { children: ReactNode }) => (
  <AuthTestProvider initialUser={null}>{children}</AuthTestProvider>
)

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderAttendees(version = 0) {
  const hook = renderHook(({ v }) => useAttendees(EVENT_ID, v), {
    wrapper: loggedIn,
    initialProps: { v: version },
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useAttendees', () => {
  it('carrega a primeira página e converte os campos', async () => {
    const list = vi.spyOn(api.agenda, 'attendees').mockResolvedValue(page([apiAttendee()]))
    const { result } = await renderAttendees()

    expect(list).toHaveBeenCalledWith(EVENT_ID, 1)
    expect(result.current.attendees).toEqual([
      { id: 'rafael-martins', name: 'Rafael Martins', initials: 'RM' },
    ])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('não busca nada para visitantes', () => {
    const list = vi.spyOn(api.agenda, 'attendees')
    const { result } = renderHook(() => useAttendees(EVENT_ID), { wrapper: loggedOut })

    expect(list).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ attendees: [], loading: false, error: null, hasMore: false })
  })

  it('Ver mais junta a página seguinte sem repetir quem já aparece', async () => {
    const list = vi
      .spyOn(api.agenda, 'attendees')
      .mockResolvedValueOnce(page([apiAttendee({ id: 'a' }), apiAttendee({ id: 'b' })], 'next', 3))
      .mockResolvedValueOnce(page([apiAttendee({ id: 'b' }), apiAttendee({ id: 'c' })], null, 3))
    const { result } = await renderAttendees()
    expect(result.current.hasMore).toBe(true)

    await act(() => result.current.loadMore())

    expect(list).toHaveBeenLastCalledWith(EVENT_ID, 2)
    expect(result.current.attendees.map((attendee) => attendee.id)).toEqual(['a', 'b', 'c'])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.loadingMore).toBe(false)
  })

  it('loadMore não faz nada sem próxima página', async () => {
    const list = vi.spyOn(api.agenda, 'attendees').mockResolvedValue(page([apiAttendee()]))
    const { result } = await renderAttendees()

    await act(() => result.current.loadMore())
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('mantém a lista e mostra o erro se a página seguinte falhar', async () => {
    vi.spyOn(api.agenda, 'attendees')
      .mockResolvedValueOnce(page([apiAttendee()], 'next', 2))
      .mockRejectedValueOnce(new TypeError('offline'))
    const { result } = await renderAttendees()

    await act(() => result.current.loadMore())

    expect(result.current.attendees).toHaveLength(1)
    expect(result.current.error).toBe('Não foi possível carregar quem vai ao evento.')
    expect(result.current.hasMore).toBe(true)
  })

  it('mostra a mensagem do backend quando a primeira página falha', async () => {
    vi.spyOn(api.agenda, 'attendees').mockRejectedValue(new ApiError('Evento não encontrado.', 404))
    const { result } = await renderAttendees()

    expect(result.current.attendees).toEqual([])
    expect(result.current.error).toBe('Evento não encontrado.')
  })

  it('usa a mensagem padrão em falhas de rede', async () => {
    vi.spyOn(api.agenda, 'attendees').mockRejectedValue(new TypeError('offline'))
    const { result } = await renderAttendees()

    expect(result.current.error).toBe('Não foi possível carregar quem vai ao evento.')
  })

  it('recarrega desde a primeira página quando a versão muda', async () => {
    const list = vi
      .spyOn(api.agenda, 'attendees')
      .mockResolvedValueOnce(page([apiAttendee({ id: 'a' })]))
      .mockResolvedValueOnce(page([apiAttendee({ id: 'eu' }), apiAttendee({ id: 'a' })]))
    const { result, rerender } = await renderAttendees(1)

    rerender({ v: 2 })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenLastCalledWith(EVENT_ID, 1)
    expect(result.current.attendees.map((attendee) => attendee.id)).toEqual(['eu', 'a'])
  })

  it('ignora a resposta que chega depois de desmontar', async () => {
    let resolve: (value: Paginated<ApiAttendee>) => void = () => {}
    vi.spyOn(api.agenda, 'attendees').mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const { result, unmount } = renderHook(() => useAttendees(EVENT_ID), { wrapper: loggedIn })
    expect(result.current.loading).toBe(true)

    unmount()
    await act(async () => resolve(page([apiAttendee()])))
    expect(result.current.attendees).toEqual([])
  })
})
