import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/hooks/useAuth'
import type { ProfileResponse } from '@/services/api'
import { api, ApiError } from '@/services/api'
import { renderWithRouter } from '@tests/render'

const profile: ProfileResponse = {
  id: 'user-1',
  nome: 'Rita Silva',
  email: 'rita@example.com',
  cidade: 'São Paulo',
  bairro: 'Pinheiros',
  preferencias: ['music'],
  iniciais: 'RS',
}

function Probe() {
  const { user, loading, signUp, signIn, signOut, updateUser } = useAuth()
  return (
    <main>
      <p>{loading ? 'loading' : (user?.name ?? 'visitor')}</p>
      <button
        onClick={() =>
          void signUp({ name: 'Rita', email: 'rita@example.com', password: 'secret123', acceptedTerms: true })
        }
      >
        register
      </button>
      <button
        onClick={() => void signIn({ email: 'rita@example.com', password: 'secret123', remember: true })}
      >
        login
      </button>
      <button onClick={() => void signOut()}>logout</button>
      <button onClick={() => updateUser(profile)}>update</button>
    </main>
  )
}

function renderProvider() {
  return renderWithRouter(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores the session and exposes registration, login, update, and logout', async () => {
    vi.spyOn(api.auth, 'currentUser').mockResolvedValue(profile)
    const register = vi.spyOn(api.auth, 'signUp').mockResolvedValue({ ...profile, nome: 'Registered' })
    const login = vi.spyOn(api.auth, 'signIn').mockResolvedValue({ ...profile, nome: 'Logged in' })
    const logout = vi.spyOn(api.auth, 'signOut').mockResolvedValue()
    const { user } = renderProvider()

    expect(await screen.findByText('Rita Silva')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'register' }))
    expect(await screen.findByText('Registered')).toBeInTheDocument()
    expect(register).toHaveBeenCalledWith({
      name: 'Rita',
      email: 'rita@example.com',
      password: 'secret123',
      acceptedTerms: true,
    })

    await user.click(screen.getByRole('button', { name: 'login' }))
    expect(await screen.findByText('Logged in')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith({ email: 'rita@example.com', password: 'secret123', remember: true })

    await user.click(screen.getByRole('button', { name: 'update' }))
    expect(await screen.findByText('Rita Silva')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'logout' }))
    expect(await screen.findByText('visitor')).toBeInTheDocument()
    expect(logout).toHaveBeenCalledOnce()
  })

  it.each([401, 403])('treats HTTP %s from the session lookup as a signed-out visitor', async (status) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(api.auth, 'currentUser').mockRejectedValue(new ApiError('No session', status))
    renderProvider()

    expect(await screen.findByText('visitor')).toBeInTheDocument()
    expect(error).not.toHaveBeenCalled()
  })

  it('logs unexpected API errors while leaving the app usable as a visitor', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = new ApiError('Backend unavailable', 500)
    vi.spyOn(api.auth, 'currentUser').mockRejectedValue(failure)
    renderProvider()

    expect(await screen.findByText('visitor')).toBeInTheDocument()
    expect(error).toHaveBeenCalledWith('Falha ao carregar a sessão CultHub.', failure)
  })

  it('does not log ordinary non-API errors during session lookup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(api.auth, 'currentUser').mockRejectedValue(new Error('network error'))
    renderProvider()

    expect(await screen.findByText('visitor')).toBeInTheDocument()
    expect(error).not.toHaveBeenCalled()
  })

  it('ignores a session response after the provider unmounts', async () => {
    let resolveSession!: (value: ProfileResponse) => void
    vi.spyOn(api.auth, 'currentUser').mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    const { unmount } = renderProvider()
    expect(screen.getByText('loading')).toBeInTheDocument()

    unmount()
    resolveSession(profile)
    await Promise.resolve()
  })

  it('ignores a session error after the provider unmounts', async () => {
    let rejectSession!: (reason?: unknown) => void
    vi.spyOn(api.auth, 'currentUser').mockReturnValue(
      new Promise((_, reject) => {
        rejectSession = reject
      }),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderProvider()

    unmount()
    rejectSession(new Error('network error'))
    await Promise.resolve()
    await Promise.resolve()

    expect(error).not.toHaveBeenCalled()
  })

  it.each([
    ['login', 'Logged in'],
    ['register', 'Registered'],
  ])('does not let a late session lookup overwrite %s', async (action, authenticatedName) => {
    let resolveSession!: (value: ProfileResponse) => void
    vi.spyOn(api.auth, 'currentUser').mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    vi.spyOn(api.auth, 'signIn').mockResolvedValue({ ...profile, nome: 'Logged in' })
    vi.spyOn(api.auth, 'signUp').mockResolvedValue({ ...profile, nome: 'Registered' })
    const { user } = renderProvider()

    await user.click(screen.getByRole('button', { name: action }))
    expect(await screen.findByText(authenticatedName)).toBeInTheDocument()

    await act(async () => {
      resolveSession({ ...profile, nome: 'Old session' })
      await Promise.resolve()
    })

    expect(screen.getByText(authenticatedName)).toBeInTheDocument()
    expect(screen.queryByText('Old session')).not.toBeInTheDocument()
  })
})
