import { vi } from 'vitest'

/** PermissionStatus falso, que avisa quem escuta quando `change(state)` é chamado. */
export function fakePermission(state: PermissionState) {
  const status = new EventTarget() as PermissionStatus & { change: (next: PermissionState) => void }
  let current = state
  Object.defineProperty(status, 'state', { get: () => current })
  status.change = (next) => {
    current = next
    status.dispatchEvent(new Event('change'))
  }
  return status
}

const realNavigator = navigator

/**
 * Troca `navigator.permissions` e `navigator.geolocation`. `null` tira a API do navegador falso, e um
 * `Error` faz o `permissions.query()` falhar. Para desfazer, use `restoreGeolocation()`: o
 * `vi.unstubAllGlobals()` também desfaria o que o setup.ts instala (ResizeObserver, matchMedia).
 */
export function stubGeolocation(
  permission: PermissionStatus | Error | null,
  getCurrentPosition: Geolocation['getCurrentPosition'] | null,
) {
  let permissions: { query: ReturnType<typeof vi.fn> } | undefined
  if (permission instanceof Error) permissions = { query: vi.fn().mockRejectedValue(permission) }
  else if (permission) permissions = { query: vi.fn().mockResolvedValue(permission) }
  const fake: Record<string, unknown> = { ...realNavigator, permissions }
  if (getCurrentPosition) fake.geolocation = { getCurrentPosition }
  else delete fake.geolocation
  vi.stubGlobal('navigator', fake)
}

/** GPS falso que só responde quando o teste manda (`succeed`/`fail`), para testar respostas atrasadas. */
export function pendingGps() {
  const calls: { success: PositionCallback; failure?: PositionErrorCallback | null }[] = []
  const getCurrentPosition = vi.fn((success: PositionCallback, failure?: PositionErrorCallback | null) => {
    calls.push({ success, failure })
  })
  return {
    getCurrentPosition,
    succeed: (latitude: number, longitude: number, call = calls.length - 1) =>
      calls[call]!.success({ coords: { latitude, longitude } } as GeolocationPosition),
    fail: (code: number, call = calls.length - 1) =>
      calls[call]!.failure?.({ code } as GeolocationPositionError),
  }
}

export function restoreGeolocation() {
  vi.stubGlobal('navigator', realNavigator)
}
