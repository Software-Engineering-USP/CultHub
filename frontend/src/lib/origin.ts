import { routeModes } from '@/lib/route'
import type { RouteMode, RouteOrigin } from '@/types'

/** Converte a origem (e o modo) em query string para levar entre as páginas "Como chegar". */
export function originSearch(origin: RouteOrigin, mode?: RouteMode): string {
  const params = new URLSearchParams({
    latitude: String(origin.latitude),
    longitude: String(origin.longitude),
  })
  if (origin.label) params.set('rotulo', origin.label)
  if (mode) params.set('modo', mode)
  return `?${params.toString()}`
}

function coordinate(value: string | null, limit: number): number | undefined {
  if (value === null || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : undefined
}

/** Lê a origem da query string; `undefined` se faltar ou estiver inválida. */
export function parseOrigin(params: URLSearchParams): RouteOrigin | undefined {
  const latitude = coordinate(params.get('latitude'), 90)
  const longitude = coordinate(params.get('longitude'), 180)
  if (latitude === undefined || longitude === undefined) return undefined
  return { latitude, longitude, label: params.get('rotulo')?.trim() || null }
}

/** Lê o modo de transporte da query string. */
export function parseMode(params: URLSearchParams): RouteMode | undefined {
  const mode = params.get('modo')
  return routeModes.find((value) => value.id === mode)?.id
}
