import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { currentUser } from '@/data/user'
import { useComments, useUserComments } from '@/hooks/useComments'
import { AuthTestProvider } from '../auth'

describe('useComments', () => {
  it('devolve só os comentários do evento', () => {
    const { result } = renderHook(() => useComments('sp-jazz-blues-festival'))
    expect(result.current).not.toHaveLength(0)
    expect(result.current.every((comment) => comment.eventId === 'sp-jazz-blues-festival')).toBe(true)
  })

  it('devolve lista vazia para evento sem comentários ou sem id', () => {
    expect(renderHook(() => useComments('derby-paulista')).result.current).toEqual([])
    expect(renderHook(() => useComments(undefined)).result.current).toEqual([])
  })
})

describe('useUserComments', () => {
  it('devolve os comentários escritos pelo usuário atual', () => {
    const { result } = renderHook(() => useUserComments(), {
      wrapper: ({ children }) => createElement(AuthTestProvider, null, children),
    })
    expect(result.current).not.toHaveLength(0)
    expect(result.current.every((comment) => comment.authorId === currentUser.id)).toBe(true)
  })
})
