import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/auth-context'
import { paths } from '@/lib/paths'
import { api, ApiError, AUTHENTICATION_FAILURE_EVENT } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import type { User } from '@/types'

function toUser(profile: ProfileResponse): User {
  return {
    id: profile.id,
    name: profile.nome,
    initials: profile.iniciais,
    email: profile.email,
    city: profile.cidade,
    state: profile.estado,
    district: profile.bairro,
    preferences: profile.preferencias,
    // Persistência de eventos salvos ainda não existe no backend.
    savedEventIds: [],
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const authVersion = useRef(0)
  const sessionCheckInProgress = useRef(false)
  const lastSessionCheckAt = useRef(0)
  const location = useLocation()
  const latestLocation = useRef(location)
  const navigate = useNavigate()

  useLayoutEffect(() => {
    latestLocation.current = location
  }, [location])

  const updateUser = useCallback((profile: ProfileResponse) => setUser(toUser(profile)), [])

  useEffect(() => {
    let active = true
    const requestVersion = authVersion.current
    api.auth
      .currentUser()
      .then((profile) => {
        if (active && requestVersion === authVersion.current) updateUser(profile)
      })
      .catch((error: unknown) => {
        if (!active || requestVersion !== authVersion.current) return
        // Uma sessão ausente é normal para visitantes; outros erros também
        // deixam o app navegável, e a próxima ação autenticada exibirá o erro.
        if (error instanceof ApiError && error.status !== 401 && error.status !== 403) {
          console.error('Falha ao carregar a sessão CultHub.', error)
        }
        if (active) setUser(null)
      })
      .finally(() => {
        if (active && requestVersion === authVersion.current) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [updateUser])

  const verifySessionAfterAuthenticationError = useCallback(() => {
    const now = Date.now()
    if (!user || sessionCheckInProgress.current || now - lastSessionCheckAt.current < 2_000) return
    sessionCheckInProgress.current = true
    lastSessionCheckAt.current = now
    const requestVersion = authVersion.current

    void api.auth
      .currentUser()
      .then((profile) => {
        if (requestVersion === authVersion.current) updateUser(profile)
      })
      .catch((error: unknown) => {
        if (
          requestVersion !== authVersion.current ||
          !(error instanceof ApiError) ||
          (error.status !== 401 && error.status !== 403)
        ) {
          return
        }

        authVersion.current += 1
        setUser(null)
        setLoading(false)
        const currentLocation = latestLocation.current
        navigate(paths.signIn, {
          replace: true,
          state: {
            from: currentLocation.pathname + currentLocation.search + currentLocation.hash,
          },
        })
      })
      .finally(() => {
        sessionCheckInProgress.current = false
      })
  }, [navigate, updateUser, user])

  useEffect(() => {
    window.addEventListener(AUTHENTICATION_FAILURE_EVENT, verifySessionAfterAuthenticationError)
    return () => {
      window.removeEventListener(AUTHENTICATION_FAILURE_EVENT, verifySessionAfterAuthenticationError)
    }
  }, [verifySessionAfterAuthenticationError])

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (data) => {
      const profile = await api.auth.signUp(data)
      authVersion.current += 1
      updateUser(profile)
      setLoading(false)
      return profile
    },
    [updateUser],
  )

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (data) => {
      const profile = await api.auth.signIn(data)
      authVersion.current += 1
      updateUser(profile)
      setLoading(false)
      return profile
    },
    [updateUser],
  )

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    authVersion.current += 1
    setUser(null)
    setLoading(false)
  }, [])

  const clearSession = useCallback(() => {
    authVersion.current += 1
    setUser(null)
    setLoading(false)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signUp, signIn, signOut, updateUser, clearSession }),
    [user, loading, signUp, signIn, signOut, updateUser, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
