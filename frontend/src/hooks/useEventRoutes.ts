import { useEffect, useState } from 'react'
import { apiMode, routableModes } from '@/lib/origin'
import type { RoutableMode } from '@/lib/origin'
import { ApiError } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { CalculatedRoute, Coordinates } from '@/types'

export type ModeRoutes =
  | { status: 'loading' }
  | { status: 'ready'; rotas: CalculatedRoute[]; destino: Coordinates }
  | { status: 'error'; error: string }

interface Answer {
  /** Consulta a que esta resposta se refere (ver `keyOf`) */
  key: string
  result: ModeRoutes
}

function keyOf(eventId: string, origin: Coordinates) {
  return `${eventId}|${origin.latitude}|${origin.longitude}`
}

const loading: ModeRoutes = { status: 'loading' }

/**
 * Rotas de carro e a pé da partida até o local do evento, pedidas em paralelo.
 * Cada modo tem o próprio estado: a falha de um não esconde o outro.
 */
export function useEventRoutes(
  eventId: string,
  origin: Coordinates | undefined,
): Record<RoutableMode, ModeRoutes> | undefined {
  const latitude = origin?.latitude
  const longitude = origin?.longitude
  const [answers, setAnswers] = useState<Partial<Record<RoutableMode, Answer>>>({})

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    const point = { latitude, longitude }
    const key = keyOf(eventId, point)
    const controllers = routableModes.map((mode) => {
      const controller = new AbortController()
      const answer = (result: ModeRoutes) => {
        if (!controller.signal.aborted) setAnswers((current) => ({ ...current, [mode]: { key, result } }))
      }
      rotasApi
        .rotaEvento(eventId, point, apiMode[mode], controller.signal)
        .then(({ rotas, destino }) => answer({ status: 'ready', rotas, destino }))
        .catch((error: unknown) =>
          answer({
            status: 'error',
            error: error instanceof ApiError ? error.message : 'Não foi possível calcular a rota.',
          }),
        )
      return controller
    })
    return () => controllers.forEach((controller) => controller.abort())
  }, [eventId, latitude, longitude])

  if (latitude === undefined || longitude === undefined) return undefined
  const key = keyOf(eventId, { latitude, longitude })
  // Respostas de uma partida anterior não valem para a atual.
  const current = (mode: RoutableMode) => (answers[mode]?.key === key ? answers[mode].result : loading)
  return { carro: current('carro'), ape: current('ape') }
}
