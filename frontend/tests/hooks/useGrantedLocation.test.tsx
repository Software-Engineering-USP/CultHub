import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGrantedLocation } from '@/hooks/useGrantedLocation'
import { fakePermission } from '@tests/geolocation'

function stub(state: PermissionState | 'erro', position?: { latitude: number; longitude: number }) {
  const getCurrentPosition = vi.fn((success: PositionCallback, failure: PositionErrorCallback) =>
    position ? success({ coords: position } as GeolocationPosition) : failure({} as GeolocationPositionError),
  )
  vi.stubGlobal('navigator', {
    ...navigator,
    permissions: {
      query:
        state === 'erro'
          ? vi.fn().mockRejectedValue(new Error('x'))
          : vi.fn().mockResolvedValue(fakePermission(state)),
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

  it('pega a posição quando a pessoa libera a permissão com a página aberta', async () => {
    const permission = fakePermission('denied')
    vi.stubGlobal('navigator', {
      ...navigator,
      permissions: { query: vi.fn().mockResolvedValue(permission) },
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: -23.6, longitude: -46.7 } } as GeolocationPosition),
      },
    })
    const { result, unmount } = renderHook(() => useGrantedLocation())
    await waitFor(() => expect(result.current).toEqual({ checking: false, position: null }))

    act(() => permission.change('granted'))
    expect(result.current.position).toEqual({ latitude: -23.6, longitude: -46.7 })

    act(() => permission.change('denied'))
    expect(result.current.position).toBeNull()

    // Ao desmontar, para de ouvir as mudanças.
    unmount()
    act(() => permission.change('granted'))
  })
})
