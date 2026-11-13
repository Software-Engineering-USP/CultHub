import { useEffect, useState } from 'react'
import { routeModes } from '@/lib/route'
import { ApiError } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaCalculada } from '@/services/rotas'
import type { Coordinates, RouteMode } from '@/types'

export type RouteState =
  { status: 'loading' } | { status: 'ready'; routes: RotaCalculada[] } | { status: 'error'; message: string }

type CalculatedMode = Exclude<RouteMode, 'onibus'>
export type EventRoutes = Record<CalculatedMode, RouteState>

const loading: EventRoutes = { carro: { status: 'loading' }, ape: { status: 'loading' } }

// O 502 costuma ser a fila do OSRM público cheia (o backend faz 1 chamada por segundo); esperar resolve.
const RETRY_DELAYS_MS = [1500, 3500]

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

async function withRetry<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (const delay of RETRY_DELAYS_MS) {
    try {
      return await load()
    } catch (error) {
      const busy = error instanceof ApiError && error.status === 502
      if (!busy || signal.aborted) throw error
      await wait(delay, signal)
    }
  }
  return load()
}

export interface EventRoutesResult {
  routes: EventRoutes
  retry: () => void
}

/** Carro e a pé em paralelo; cada modo carrega e falha sozinho. */
export function useEventRoutes(
  eventId: string,
  origin: Coordinates | undefined,
): EventRoutesResult | undefined {
  const latitude = origin?.latitude
  const longitude = origin?.longitude
  const [attempt, setAttempt] = useState(0)
  const key = origin ? `${eventId}|${latitude}|${longitude}|${attempt}` : ''
  const [state, setState] = useState<{ key: string; routes: EventRoutes } | null>(null)

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    const partida = { latitude, longitude }
    const controller = new AbortController()

    for (const mode of routeModes) {
      const { backend } = mode
      if (!backend) continue
      const modeId = mode.id as CalculatedMode
      const update = (route: RouteState) => {
        // Resposta de uma partida anterior: não pode sobrescrever a atual.
        if (controller.signal.aborted) return
        setState((current) => ({
          key,
          routes: { ...(current?.key === key ? current.routes : loading), [modeId]: route },
        }))
      }
      withRetry(() => rotasApi.rota(eventId, partida, backend, controller.signal), controller.signal)
        .then((routes) => update({ status: 'ready', routes }))
        .catch((error: unknown) =>
          update({
            status: 'error',
            message: error instanceof ApiError ? error.message : 'Não foi possível calcular a rota.',
          }),
        )
    }
    return () => controller.abort()
  }, [eventId, key, latitude, longitude])

  if (!key) return undefined
  return {
    routes: state?.key === key ? state.routes : loading,
    retry: () => setAttempt((value) => value + 1),
  }
}
