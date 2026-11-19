import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { api, ApiError } from '@/services/api'

describe('usePublicProfile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ao ser reativado, volta a carregar em vez de mostrar o erro antigo', async () => {
    const profile = vi
      .spyOn(api.users, 'profile')
      .mockRejectedValueOnce(new ApiError('Sessão expirada.', 403))
    const { result, rerender } = renderHook(({ enabled }) => usePublicProfile('caio-prado', enabled), {
      initialProps: { enabled: true },
    })
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError))

    rerender({ enabled: false })
    profile.mockReturnValue(new Promise(() => {}))
    rerender({ enabled: true })

    expect(result.current).toMatchObject({ loading: true, profile: undefined, error: null })
    expect(profile).toHaveBeenCalledTimes(2)
  })
})
