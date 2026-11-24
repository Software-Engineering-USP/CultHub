import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalitiesCache, LOCALITIES_TIMEOUT_MS, useCities, useStates } from '@/hooks/useLocalities'
import { api } from '@/services/api'

describe('useLocalities', () => {
  beforeEach(() => {
    clearLocalitiesCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('consulta sem resposta vira erro depois do prazo, e "retry" consulta de novo', async () => {
    vi.useFakeTimers()
    const cities = vi
      .spyOn(api.localities, 'cities')
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(['Salvador'])
    const { result } = renderHook(() => useCities('BA'))
    expect(result.current.loading).toBe(true)

    await act(() => vi.advanceTimersByTimeAsync(LOCALITIES_TIMEOUT_MS))
    expect(result.current).toMatchObject({ loading: false, error: 'As cidades demoraram a carregar.' })

    await act(async () => result.current.retry())
    expect(result.current).toMatchObject({ loading: false, error: null, cities: ['Salvador'] })
    expect(cities).toHaveBeenCalledTimes(2)
  })

  it('lista de estados que falhou pode ser consultada de novo', async () => {
    const states = vi
      .spyOn(api.localities, 'states')
      .mockRejectedValueOnce(new Error('Falha de rede.'))
      .mockResolvedValueOnce([{ sigla: 'SP', nome: 'São Paulo' }])
    const { result } = renderHook(() => useStates())
    await waitFor(() => expect(result.current.error).toBe('Falha de rede.'))

    act(() => result.current.retry())
    expect(result.current.error).toBeNull()
    await waitFor(() => expect(result.current.states).toEqual([{ sigla: 'SP', nome: 'São Paulo' }]))
    expect(states).toHaveBeenCalledTimes(2)
  })
})
