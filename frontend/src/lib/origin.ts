import type { Coordinates, RouteOrigin, TransportMode, TransportModeId } from '@/types'

/** Modos da tela "Como chegar". O backend ainda não calcula rota de ônibus. */
export const transportModes: TransportMode[] = [
  { id: 'carro', label: 'Carro', available: true },
  { id: 'onibus', label: 'Ônibus', available: false },
  { id: 'ape', label: 'A pé', available: true },
]

/** Modos com rota calculada pelo backend. */
export type RoutableMode = Exclude<TransportModeId, 'onibus'>

export const routableModes: RoutableMode[] = ['carro', 'ape']

/** Valor do parâmetro `modo` da API de rotas. */
export const apiMode: Record<RoutableMode, 'carro' | 'a_pe'> = { carro: 'carro', ape: 'a_pe' }

/** Converte a origem (e o modo) em query string para levar entre as páginas "Como chegar". */
export function originSearch(origin: RouteOrigin, mode?: TransportModeId): string {
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

/** Lê o modo de transporte da query string; modos ainda indisponíveis (ônibus) são ignorados. */
export function parseMode(params: URLSearchParams): RoutableMode | undefined {
  const mode = params.get('modo')
  return routableModes.find((value) => value === mode)
}

/** Duração legível: "45 s", "19 min", "2 h 25 min", "3 h". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

const kilometers = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** Distância legível: "850 m", "10,7 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${kilometers.format(meters / 1000)} km`
}

/** Link para abrir o trajeto no site do OpenStreetMap, com o mesmo motor de rotas do backend. */
export function openStreetMapDirections(origin: Coordinates, destination: Coordinates, mode: RoutableMode) {
  const engine = mode === 'carro' ? 'fossgis_osrm_car' : 'fossgis_osrm_foot'
  const point = ({ latitude, longitude }: Coordinates) => `${latitude},${longitude}`
  const params = new URLSearchParams({ engine, route: `${point(origin)};${point(destination)}` })
  return `https://www.openstreetmap.org/directions?${params.toString()}`
}
