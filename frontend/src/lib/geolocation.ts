import type { Coordinates } from '@/types'

/** Código de GeolocationPositionError para permissão negada. */
export const PERMISSION_DENIED = 1

/** Leitura pedida pela pessoa (botão): precisa e recente. */
export const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }

/**
 * Leitura silenciosa ao abrir a página, com a permissão já dada: em desktop e notebook a alta precisão
 * demora ou estoura o tempo, e uma posição de até 5 minutos atrás basta para estimar a rota.
 */
export const QUICK: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }

/** Único lugar que chama o GPS; rejeita com o GeolocationPositionError do navegador. */
export function readPosition(options: PositionOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject,
      options,
    )
  })
}
