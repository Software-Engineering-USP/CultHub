import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGrantedLocation } from '@/hooks/useGrantedLocation'

function stub(state: PermissionState | 'erro', position?: { latitude: number; longitude: number }) {
  const getCurrentPosition = vi.fn((success: PositionCallback, failure: PositionErrorCallback) =>
    position ? success({ coords: position } as GeolocationPosition) : failure({} as GeolocationPositionError),
  )
  vi.stubGlobal('navigator', {
    ...navigator,
    permissions: {
      query:
        state === 'erro' ? vi.fn().mockRejectedValue(new Error('x')) : vi.fn().mockResolvedValue({ state }),
    },
    geolocation: { getCurrentPosition },
  })
  return getCurrentPosition
}

describe('useGrantedLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('com permissão já dada, devolve a posição do aparelho', async () => {
    stub('granted', { latitude: -23.6, longitude: -46.7 })
    const { result } = renderHook(() => useGrantedLocation())
    expect(result.current.checking).toBe(true)
    await waitFor(() =>
      expect(result.current).toEqual({ checking: false, position: { latitude: -23.6, longitude: -46.7 } }),
    )
  })

  it.each(['prompt', 'denied', 'erro'] as const)('com permissão "%s", não pede a posição', async (state) => {
    const getCurrentPosition = stub(state)
    const { result } = renderHook(() => useGrantedLocation())
    await waitFor(() => expect(result.current).toEqual({ checking: false, position: null }))
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('termina sem posição quando o aparelho não consegue a localização', async () => {
    stub('granted')
    const { result } = renderHook(() => useGrantedLocation())
    await waitFor(() => expect(result.current).toEqual({ checking: false, position: null }))
  })
})
