import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { events } from '@/data/events'
import { currentUser } from '@/data/user'
import { useEvent, useEventById, useEvents, useSavedEvents } from '@/hooks/useEvents'
import { paths, routes } from '@/lib/paths'
import { AuthTestProvider } from '../auth'

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
  it('devolve os eventos salvos do usuário, na mesma ordem', () => {
    const { result } = renderHook(() => useSavedEvents(), {
      wrapper: ({ children }) => <AuthTestProvider>{children}</AuthTestProvider>,
    })
    expect(result.current.map((event) => event.id)).toEqual(currentUser.savedEventIds)
  })
})
