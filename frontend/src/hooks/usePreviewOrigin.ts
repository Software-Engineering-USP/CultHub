import { useGrantedLocation } from '@/hooks/useGrantedLocation'
import { CENTRO_PADRAO } from '@/lib/leaflet'
import { distanceKm, MAX_DISTANCE_KM } from '@/lib/route'
import type { Coordinates, RouteOrigin } from '@/types'

export interface PreviewOrigin {
  origin: RouteOrigin
  source: 'device' | 'center'
}

const center: RouteOrigin = { ...CENTRO_PADRAO, label: 'Centro de São Paulo' }

/**
 * Localização do aparelho (se já permitida) ou o centro de SP; `null` se o evento fica longe demais do centro.
 * Fica `undefined` enquanto confere a permissão, para não calcular a rota duas vezes.
 */
export function usePreviewOrigin(destination: Coordinates | undefined): PreviewOrigin | null | undefined {
  const { checking, position } = useGrantedLocation()
  if (checking) return undefined
  if (position) return { origin: { ...position, label: 'Sua localização' }, source: 'device' }
  if (destination && distanceKm(center, destination) > MAX_DISTANCE_KM.carro) return null
  return { origin: center, source: 'center' }
}
