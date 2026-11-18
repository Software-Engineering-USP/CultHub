import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDeviceLocation } from '@/hooks/useDeviceLocation'
import { fakePermission } from '@tests/geolocation'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stub(
  getCurrentPosition: Geolocation['getCurrentPosition'] | undefined,
  state: PermissionState = 'prompt',
) {
  vi.stubGlobal('navigator', {
    ...navigator,
    permissions: { query: vi.fn().mockResolvedValue(fakePermission(state)) },
    ...(getCurrentPosition ? { geolocation: { getCurrentPosition } } : { geolocation: undefined }),
  })
}

describe('useDeviceLocation', () => {
  it('request() pede a posição e guarda o resultado', async () => {
    stub((success) => success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition))
    const { result } = renderHook(() => useDeviceLocation())
    expect(result.current.position).toBeNull()

    act(() => result.current.request())
    await waitFor(() => expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }))
    expect(result.current.status).toBe('idle')
  })

  it('diferencia permissão negada de localização indisponível', () => {
    stub((_, failure) => failure?.({ code: 1 } as GeolocationPositionError))
    const denied = renderHook(() => useDeviceLocation())
    act(() => denied.result.current.request())
    expect(denied.result.current.status).toBe('denied')

    stub((_, failure) => failure?.({ code: 2 } as GeolocationPositionError))
    const unavailable = renderHook(() => useDeviceLocation())
    act(() => unavailable.result.current.request())
    expect(unavailable.result.current.status).toBe('unavailable')
  })

  it('o aviso de negada some se a permissão for liberada depois', async () => {
    const permission = fakePermission('prompt')
    let allow = false
    vi.stubGlobal('navigator', {
      ...navigator,
      permissions: { query: vi.fn().mockResolvedValue(permission) },
      geolocation: {
        getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) =>
          allow
            ? success({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition)
            : failure?.({ code: 1 } as GeolocationPositionError),
      },
    })
    const { result } = renderHook(() => useDeviceLocation())
    act(() => result.current.request())
    expect(result.current.status).toBe('denied')

    allow = true
    act(() => permission.change('granted'))
    await waitFor(() => expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }))
    expect(result.current.status).toBe('idle')
  })
})
