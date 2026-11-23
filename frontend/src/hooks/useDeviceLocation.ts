import { useCallback, useEffect, useRef, useState } from 'react'
import { PERMISSION_DENIED, PRECISE, QUICK, readPosition } from '@/lib/geolocation'
import type { Coordinates } from '@/types'

export type LocationStatus = 'idle' | 'locating' | 'denied' | 'unavailable'

export interface DeviceLocation {
  position: Coordinates | null
  status: LocationStatus
  /** Ainda conferindo a permissão (ou lendo a posição já permitida) ao abrir a página */
  checking: boolean
  /** Pede a permissão e a posição (para botões como "Minha localização") */
  request: (onSuccess?: (position: Coordinates) => void) => void
}

// Sem a API de permissões não dá para saber se já foi permitido; só o botão pede a posição.
const canCheckPermission = () => 'geolocation' in navigator && Boolean(navigator.permissions)

/**
 * Posição do aparelho. Se a permissão já foi dada, vem sem perguntar nada; `request()` pede a permissão.
 * Acompanha a permissão nas configurações do navegador: liberar traz a posição e revogar a tira.
 */
export function useDeviceLocation(): DeviceLocation {
  const [position, setPosition] = useState<Coordinates | null>(null)
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [checking, setChecking] = useState(canCheckPermission)
  // Muda a cada leitura nova; uma resposta do GPS de uma leitura anterior é descartada.
  const generation = useRef(0)
  const requesting = useRef(false)
  const mounted = useRef(true)

  const onPermission = useCallback((state: PermissionState) => {
    // Com um pedido do botão em andamento, ele decide a posição: uma segunda leitura seria repetida,
    // e invalidá-lo faria a resposta se perder (ex.: clique antes de a permissão responder).
    if (!requesting.current) generation.current += 1
    const current = generation.current
    if (state !== 'granted') setPosition(null)
    if (state !== 'granted' || requesting.current) {
      setChecking(false)
      return
    }
    readPosition(QUICK)
      .then((next) => {
        if (!mounted.current || current !== generation.current) return
        setPosition(next)
        setStatus('idle')
      })
      .catch(() => {
        if (mounted.current && current === generation.current) setPosition(null)
      })
      .finally(() => {
        if (mounted.current && current === generation.current) setChecking(false)
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    // Local a cada execução, e não o ref: no StrictMode (montar, limpar, montar) o ref volta a ser true
    // antes de a primeira consulta responder, e ela registraria um listener que ninguém remove.
    let active = true
    let permission: PermissionStatus | undefined
    const onChange = () => {
      if (permission) onPermission(permission.state)
    }
    if (canCheckPermission()) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          // Desmontou antes da resposta: não registra nada que depois não seria removido.
          if (!active) return
          permission = status
          status.addEventListener('change', onChange)
          onPermission(status.state)
        })
        .catch(() => {
          if (active) setChecking(false)
        })
    }
    return () => {
      active = false
      mounted.current = false
      permission?.removeEventListener('change', onChange)
    }
  }, [onPermission])

  const request = useCallback((onSuccess?: (position: Coordinates) => void) => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }
    generation.current += 1
    const current = generation.current
    requesting.current = true
    setStatus('locating')
    // O pedido invalida a leitura silenciosa em andamento, que então não terminaria a checagem.
    setChecking(false)
    readPosition(PRECISE)
      .then((next) => {
        if (!mounted.current || current !== generation.current) return
        setPosition(next)
        setStatus('idle')
        onSuccess?.(next)
      })
      .catch((error: GeolocationPositionError) => {
        if (!mounted.current || current !== generation.current) return
        setStatus(error.code === PERMISSION_DENIED ? 'denied' : 'unavailable')
      })
      .finally(() => {
        // Um pedido superado não pode liberar a vez do pedido mais novo, ainda em andamento.
        if (current === generation.current) requesting.current = false
      })
  }, [])

  return { position, status, checking, request }
}
