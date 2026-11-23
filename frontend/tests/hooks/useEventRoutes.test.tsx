import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEventRoutes } from '@/hooks/useEventRoutes'
import { ApiError } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaCalculada } from '@/services/rotas'
import type { Coordinates } from '@/types'

// Partida e destino a ~1 km: dentro do limite de carro e a pé.
const perto = { latitude: 1, longitude: 2.01 }

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
    const { result } = renderHook(() => useEventRoutes('e', undefined, perto))
    expect(result.current).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('cada modo chega e falha sozinho', async () => {
    vi.spyOn(rotasApi, 'rota').mockImplementation(async (_e, _p, modo) => {
      if (modo === 'a_pe') throw new Error('rede')
      return [rota]
    })
    const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }, perto))

    expect(result.current?.routes).toEqual({ carro: { status: 'loading' }, ape: { status: 'loading' } })
    await waitFor(() =>
      expect(result.current?.routes).toEqual({
        carro: { status: 'ready', routes: [rota] },
        ape: { status: 'error', message: 'Não foi possível calcular a rota.', retryable: true },
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
      ({ origin }: { origin: Coordinates }) => useEventRoutes('e', origin, perto),
      {
        initialProps: { origin: { latitude: 1, longitude: 2 } },
      },
    )

    rerender({ origin: { latitude: 1.001, longitude: 2 } })
    await waitFor(() => expect(result.current?.routes.carro).toEqual({ status: 'ready', routes: [rota] }))
    await act(async () => resolveOld([{ ...rota, distancia_metros: 9 }]))
    expect(result.current?.routes.carro).toEqual({ status: 'ready', routes: [rota] })
  })

  it('com a fila cheia (503), tenta de novo uma vez sozinho', async () => {
    vi.useFakeTimers()
    try {
      const busy = new ApiError('ocupado', 503)
      const spy = vi
        .spyOn(rotasApi, 'rota')
        .mockImplementation(async (_e, _p, modo) => (modo === 'a_pe' ? [rota] : Promise.reject(busy)))
      const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }, perto))

      await act(() => vi.advanceTimersByTimeAsync(2000))
      expect(result.current?.routes.carro).toEqual({ status: 'error', message: 'ocupado', retryable: true })
      expect(spy.mock.calls.filter(([, , modo]) => modo === 'carro')).toHaveLength(2)
      expect(result.current?.routes.ape).toEqual({ status: 'ready', routes: [rota] })

      spy.mockResolvedValue([rota])
      act(() => result.current?.retry())
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(result.current?.routes.carro).toEqual({ status: 'ready', routes: [rota] })
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    [502, true],
    [429, true],
    [0, true],
    [400, false],
    [422, false],
  ])('HTTP %i não repete sozinho; "Tentar de novo" vale: %s', async (status, retryable) => {
    const spy = vi.spyOn(rotasApi, 'rota').mockRejectedValue(new ApiError('erro', status))
    const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }, perto))
    await waitFor(() =>
      expect(result.current?.routes.carro).toEqual({ status: 'error', message: 'erro', retryable }),
    )
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('nem chama o backend para o modo além do limite de distância', async () => {
    const spy = vi.spyOn(rotasApi, 'rota').mockResolvedValue([rota])
    // ~111 km: cabe de carro (até 150 km), não a pé (até 30 km).
    const { result } = renderHook(() =>
      useEventRoutes('e', { latitude: 1, longitude: 2 }, { latitude: 2, longitude: 2 }),
    )

    await waitFor(() => expect(result.current?.routes.carro.status).toBe('ready'))
    expect(result.current?.routes.ape).toMatchObject({
      status: 'error',
      retryable: false,
      short: 'mais de 30 km',
    })
    expect(spy.mock.calls.map(([, , modo]) => modo)).toEqual(['carro'])
  })

  it('sem coordenadas do local, não chama o backend', () => {
    const spy = vi.spyOn(rotasApi, 'rota')
    const { result } = renderHook(() => useEventRoutes('e', { latitude: 1, longitude: 2 }, undefined))

    expect(result.current?.routes.carro).toMatchObject({ status: 'error', retryable: false })
    expect(result.current?.routes.ape).toMatchObject({ status: 'error', retryable: false })
    expect(spy).not.toHaveBeenCalled()
  })
})
