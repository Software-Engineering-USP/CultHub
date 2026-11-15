import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEventRoutes } from '@/hooks/useEventRoutes'
import { ApiError } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaEvento } from '@/services/rotas'

const destino = { latitude: -23.6, longitude: -46.72 }
const rota = (duracao: number) => ({
  distancia_metros: 1000,
  duracao_segundos: duracao,
  geometria: { type: 'LineString' as const, coordinates: [] },
})

describe('useEventRoutes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não pede nada sem partida', () => {
    const spy = vi.spyOn(rotasApi, 'rotaEvento')
    const { result } = renderHook(() => useEventRoutes('ev', undefined))
    expect(result.current).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('pede carro e a pé em paralelo; a falha de um não esconde o outro', async () => {
    const spy = vi
      .spyOn(rotasApi, 'rotaEvento')
      .mockImplementation((_id, _ponto, modo) =>
        modo === 'carro'
          ? Promise.resolve<RotaEvento>({ modo, destino, rotas: [rota(600)] })
          : Promise.reject(new ApiError('Escolha um ponto a até 30 km.', 400)),
      )
    const origin = { latitude: -23.5, longitude: -46.6 }
    const { result } = renderHook(() => useEventRoutes('ev', origin))
    expect(result.current).toEqual({ carro: { status: 'loading' }, ape: { status: 'loading' } })

    await waitFor(() => expect(result.current?.ape.status).toBe('error'))
    expect(result.current).toEqual({
      carro: { status: 'ready', rotas: [rota(600)], destino },
      ape: { status: 'error', error: 'Escolha um ponto a até 30 km.' },
    })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith('ev', origin, 'carro', expect.any(AbortSignal))
    expect(spy).toHaveBeenCalledWith('ev', origin, 'a_pe', expect.any(AbortSignal))
  })

  it('usa uma mensagem padrão para erros inesperados', async () => {
    vi.spyOn(rotasApi, 'rotaEvento').mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useEventRoutes('ev', { latitude: 0, longitude: 0 }))
    await waitFor(() => expect(result.current?.carro.status).toBe('error'))
    expect(result.current?.carro).toEqual({ status: 'error', error: 'Não foi possível calcular a rota.' })
  })

  it('cancela os pedidos da partida anterior e ignora respostas antigas', async () => {
    const signals: AbortSignal[] = []
    vi.spyOn(rotasApi, 'rotaEvento').mockImplementation((_id, ponto, modo, signal) => {
      signals.push(signal!)
      return Promise.resolve({ modo, destino, rotas: [rota(ponto.latitude === 1 ? 60 : 120)] })
    })
    const { result, rerender } = renderHook(({ origin }) => useEventRoutes('ev', origin), {
      initialProps: { origin: { latitude: 1, longitude: 1 } },
    })
    rerender({ origin: { latitude: 2, longitude: 2 } })
    expect(signals.slice(0, 2).every((signal) => signal.aborted)).toBe(true)
    // Logo depois da troca, a resposta da partida anterior não vale.
    expect(result.current?.carro.status).toBe('loading')
    await waitFor(() => expect(result.current?.carro.status).toBe('ready'))
    expect(result.current?.carro).toMatchObject({ rotas: [rota(120)] })
  })
})
