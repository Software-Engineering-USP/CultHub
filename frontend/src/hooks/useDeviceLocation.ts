import { useState } from 'react'
import { useGrantedLocation } from '@/hooks/useGrantedLocation'
import type { Coordinates } from '@/types'

export type LocationStatus = 'idle' | 'locating' | 'denied' | 'unavailable'

/** Código de GeolocationPositionError para permissão negada. */
const PERMISSION_DENIED = 1

/**
 * Posição do aparelho: já vem preenchida se a permissão foi dada antes, e `request()` pede a permissão
 * (para botões como "Minha localização").
 */
export function useDeviceLocation() {
  const granted = useGrantedLocation()
  const [requested, setRequested] = useState<Coordinates | null>(null)
  const [status, setStatus] = useState<LocationStatus>('idle')

  function request() {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setRequested({ latitude: coords.latitude, longitude: coords.longitude })
        setStatus('idle')
      },
      (error) => setStatus(error.code === PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return { position: requested ?? granted.position, status, request }
}
