import type { ModoCalculado } from '@/services/rotas'
import type { Coordinates, RouteMode } from '@/types'

export interface RouteModeInfo {
  id: RouteMode
  label: string
  /** Ônibus não tem rota no backend */
  backend?: ModoCalculado
  googleMaps: 'driving' | 'transit' | 'walking'
}

export const routeModes: RouteModeInfo[] = [
  { id: 'carro', label: 'Carro', backend: 'carro', googleMaps: 'driving' },
  { id: 'onibus', label: 'Ônibus', googleMaps: 'transit' },
  { id: 'ape', label: 'A pé', backend: 'a_pe', googleMaps: 'walking' },
]

export function routeMode(id: RouteMode): RouteModeInfo {
  return routeModes.find((mode) => mode.id === id) ?? routeModes[0]
}

export function formatDistance(meters: number): string {
  const rounded = Math.round(meters / 10) * 10
  if (rounded < 1000) return `${rounded} m`
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(meters / 1000)} km`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, '0')} min` : ''}`
}

const point = ({ latitude, longitude }: Coordinates) => `${latitude},${longitude}`

export function googleMapsUrl(origin: Coordinates, destination: string, mode: RouteMode): string {
  const params = new URLSearchParams({
    api: '1',
    origin: point(origin),
    destination,
    travelmode: routeMode(mode).googleMaps,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

const EARTH_RADIUS_KM = 6371

/** Em linha reta, como o backend calcula para limitar a partida. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export const MAX_DISTANCE_KM: Record<'carro' | 'ape', number> = { carro: 150, ape: 30 }
