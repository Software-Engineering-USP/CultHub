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
 * Troca `navigator.permissions` e `navigator.geolocation`. Para desfazer, use `restoreGeolocation()`:
 * o `vi.unstubAllGlobals()` também desfaria o que o setup.ts instala (ResizeObserver, matchMedia).
 */
export function stubGeolocation(
  permission: PermissionStatus,
  getCurrentPosition: Geolocation['getCurrentPosition'],
) {
  vi.stubGlobal('navigator', {
    ...realNavigator,
    permissions: { query: vi.fn().mockResolvedValue(permission) },
    geolocation: { getCurrentPosition },
  })
}

export function restoreGeolocation() {
  vi.stubGlobal('navigator', realNavigator)
}
