import { useEffect, useState } from 'react'
import type { Coordinates } from '@/types'

export interface GrantedLocation {
  /** Ainda conferindo a permissão ou esperando a posição */
  checking: boolean
  position: Coordinates | null
}

/** Posição do aparelho só se a pessoa já deu permissão antes; nunca abre o pedido de permissão. */
export function useGrantedLocation(): GrantedLocation {
  const [state, setState] = useState<GrantedLocation>({ checking: true, position: null })

  useEffect(() => {
    let active = true
    const done = (position: Coordinates | null) => {
      if (active) setState({ checking: false, position })
    }
    if (!navigator.permissions || !('geolocation' in navigator)) {
      done(null)
      return
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (status.state !== 'granted') return done(null)
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => done({ latitude: coords.latitude, longitude: coords.longitude }),
          () => done(null),
          { maximumAge: 300_000, timeout: 10_000 },
        )
      })
      .catch(() => done(null))
    return () => {
      active = false
    }
  }, [])

  return state
}
