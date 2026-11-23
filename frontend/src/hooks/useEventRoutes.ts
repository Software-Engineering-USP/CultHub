import { useEffect, useState } from 'react'
import { distanceKm, MAX_DISTANCE_KM, routeModes } from '@/lib/route'
import { ApiError } from '@/services/catalog'
import { rotasApi, SEM_CONEXAO } from '@/services/rotas'
import type { RotaCalculada } from '@/services/rotas'
import type { Coordinates, RouteMode } from '@/types'

export type RouteState =
  | { status: 'loading' }
  | { status: 'ready'; routes: RotaCalculada[] }
  | {
      status: 'error'
      message: string
      /** Repetir pode dar certo (sem conexão, limite de pedidos, serviço fora ou ocupado) */
      retryable: boolean
      /** Resumo curto para os cartões, quando há um motivo mais claro que "indisponível" */
      short?: string
    }

type CalculatedMode = Exclude<RouteMode, 'onibus'>
export type EventRoutes = Record<CalculatedMode, RouteState>

const loading: EventRoutes = { carro: { status: 'loading' }, ape: { status: 'loading' } }

// 503: a fila do OSRM público está cheia (o backend faz 1 chamada por segundo). Uma nova tentativa,
// no tempo do Retry-After, costuma bastar; o 502 (serviço fora do ar) não melhora repetindo logo.
const RETRY_DELAYS_MS = [2000]

const RETRYABLE = new Set([SEM_CONEXAO, 429, 502, 503])

function failure(error: unknown): RouteState {
  if (error instanceof ApiError) {
    return { status: 'error', message: error.message, retryable: RETRYABLE.has(error.status) }
  }
  return { status: 'error', message: 'Não foi possível calcular a rota.', retryable: true }
}

const NO_LOCATION: RouteState = {
  status: 'error',
  message: 'O local deste evento não tem coordenadas, então não dá para calcular a rota.',
  retryable: false,
  short: 'local sem mapa',
}

// O backend recusa partidas além desse limite em linha reta; nem vale chamar.
function tooFar(mode: CalculatedMode): RouteState {
  const max = MAX_DISTANCE_KM[mode]
  return {
    status: 'error',
    message: `Escolha um ponto de partida a até ${max} km do local do evento.`,
    retryable: false,
    short: `mais de ${max} km`,
  }
}

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

async function withRetry<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
  delays = RETRY_DELAYS_MS,
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    const [delay, ...remaining] = delays
    const busy = error instanceof ApiError && error.status === 503
    if (!busy || delay === undefined || signal.aborted) throw error
    await wait(delay, signal)
    return withRetry(load, signal, remaining)
  }
}

export interface EventRoutesResult {
  routes: EventRoutes
  retry: () => void
}

/** Carro e a pé em paralelo; cada modo carrega e falha sozinho. */
export function useEventRoutes(
  eventId: string,
  origin: Coordinates | undefined,
  destination: Coordinates | undefined,
): EventRoutesResult | undefined {
  const latitude = origin?.latitude
  const longitude = origin?.longitude
  const destinationLat = destination?.latitude
  const destinationLng = destination?.longitude
  const [attempt, setAttempt] = useState(0)
  const key = origin ? `${eventId}|${latitude}|${longitude}|${attempt}` : ''
  const [state, setState] = useState<{ key: string; routes: EventRoutes } | null>(null)

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    const partida = { latitude, longitude }
    const destino =
      destinationLat === undefined || destinationLng === undefined
        ? undefined
        : { latitude: destinationLat, longitude: destinationLng }
    const distance = destino && distanceKm(partida, destino)
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
      if (distance === undefined) {
        update(NO_LOCATION)
        continue
      }
      if (distance > MAX_DISTANCE_KM[modeId]) {
        update(tooFar(modeId))
        continue
      }
      withRetry(() => rotasApi.rota(eventId, partida, backend, controller.signal), controller.signal)
        .then((routes) => update({ status: 'ready', routes }))
        .catch((error: unknown) => update(failure(error)))
    }
    return () => controller.abort()
  }, [eventId, key, latitude, longitude, destinationLat, destinationLng])

  if (!key) return undefined
  return {
    routes: state?.key === key ? state.routes : loading,
    retry: () => setAttempt((value) => value + 1),
  }
}
