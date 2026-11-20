import type { Coordinates } from '@/types'

/** Código de GeolocationPositionError para permissão negada. */
export const PERMISSION_DENIED = 1

/** Único lugar que chama o GPS; rejeita com o GeolocationPositionError do navegador. */
export function readPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
