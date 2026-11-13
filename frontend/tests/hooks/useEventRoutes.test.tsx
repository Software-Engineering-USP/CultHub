import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEventRoutes } from '@/hooks/useEventRoutes'
import { ApiError } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaCalculada } from '@/services/rotas'
import type { Coordinates } from '@/types'

const rota: RotaCalculada = {
  distancia_metros: 1000,
  duracao_segundos: 600,
  geometria: { type: 'LineString', coordinates: [] },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useEventRoutes', () => {
  it('não busca nada sem partida', () => {
    const spy = vi.spyOn(rotasApi, 'rota')
    const { result } = renderHook(() => useEventRoutes('e', undefined))
    expect(result.current).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('cada modo chega e falha sozinho', async () => {
    vi.spyOn(rotasApi, 'rota').mockImplementation(async (_e, _p, modo) => {
      if (modo === 'a_pe') throw new Error('rede')
      return [rota]
    })
    const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }))

    expect(result.current?.routes).toEqual({ carro: { status: 'loading' }, ape: { status: 'loading' } })
    await waitFor(() =>
      expect(result.current?.routes).toEqual({
        carro: { status: 'ready', routes: [rota] },
        ape: { status: 'error', message: 'Não foi possível calcular a rota.' },
      }),
    )
  })

  it('ignora a resposta de uma partida anterior', async () => {
    let resolveOld!: (value: RotaCalculada[]) => void
    vi.spyOn(rotasApi, 'rota')
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue([rota])
    const { result, rerender } = renderHook(
      ({ origin }: { origin: Coordinates }) => useEventRoutes('e', origin),
      {
        initialProps: { origin: { latitude: 1, longitude: 2 } },
      },
    )

    rerender({ origin: { latitude: 3, longitude: 4 } })
    await waitFor(() => expect(result.current?.routes.carro).toEqual({ status: 'ready', routes: [rota] }))
    await act(async () => resolveOld([{ ...rota, distancia_metros: 9 }]))
    expect(result.current?.routes.carro).toEqual({ status: 'ready', routes: [rota] })
  })

  it('tenta de novo sozinho quando o serviço de rotas está ocupado (502)', async () => {
    vi.useFakeTimers()
    try {
      const busy = new ApiError('ocupado', 502)
      const spy = vi
        .spyOn(rotasApi, 'rota')
        .mockImplementation(async (_e, _p, modo) => (modo === 'a_pe' ? [rota] : Promise.reject(busy)))
      spy.mockRejectedValueOnce(busy)
      const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }))

      await act(() => vi.advanceTimersByTimeAsync(1500 + 3500))
      expect(result.current?.routes.carro).toEqual({ status: 'error', message: 'ocupado' })
      expect(spy.mock.calls.filter(([, , modo]) => modo === 'carro')).toHaveLength(3)
      expect(result.current?.routes.ape).toEqual({ status: 'ready', routes: [rota] })

      spy.mockResolvedValue([rota])
      act(() => result.current?.retry())
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(result.current?.routes.carro).toEqual({ status: 'ready', routes: [rota] })
    } finally {
      vi.useRealTimers()
    }
  })

  it('não repete erros que não são de serviço ocupado', async () => {
    const spy = vi.spyOn(rotasApi, 'rota').mockRejectedValue(new ApiError('Longe demais.', 400))
    const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }))
    await waitFor(() =>
      expect(result.current?.routes.carro).toEqual({ status: 'error', message: 'Longe demais.' }),
    )
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
