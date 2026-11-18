import { useEffect, useState } from 'react'
import type { Coordinates } from '@/types'

export interface GrantedLocation {
  /** Ainda conferindo a permissão ou esperando a posição */
  checking: boolean
  position: Coordinates | null
}

/**
 * Posição do aparelho só se a pessoa já deu permissão; nunca abre o pedido de permissão.
 * Acompanha mudanças feitas nas configurações do navegador enquanto a página está aberta.
 */
export function useGrantedLocation(): GrantedLocation {
  const [state, setState] = useState<GrantedLocation>({ checking: true, position: null })

  useEffect(() => {
    let active = true
    let permission: PermissionStatus | undefined
    const done = (position: Coordinates | null) => {
      if (active) setState({ checking: false, position })
    }
    const read = () => {
      if (permission?.state !== 'granted') return done(null)
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => done({ latitude: coords.latitude, longitude: coords.longitude }),
        () => done(null),
        { maximumAge: 300_000, timeout: 10_000 },
      )
    }
    if (!navigator.permissions || !('geolocation' in navigator)) {
      done(null)
      return
    }
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        permission = status
        status.addEventListener('change', read)
        read()
      })
      .catch(() => done(null))
    return () => {
      active = false
      permission?.removeEventListener('change', read)
    }
  }, [])

  return state
}
