import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError, api } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signUp: typeof api.auth.signUp
  signIn: typeof api.auth.signIn
  signOut: () => Promise<void>
  updateUser: (profile: ProfileResponse) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function toUser(profile: ProfileResponse): User {
  return {
    id: profile.id,
    name: profile.nome,
    initials: profile.iniciais,
    email: profile.email,
    city: profile.cidade,
    district: profile.bairro,
    preferences: profile.preferencias,
    // Persistência de eventos salvos ainda não existe no backend.
    savedEventIds: [],
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const updateUser = useCallback((profile: ProfileResponse) => setUser(toUser(profile)), [])

  useEffect(() => {
    let active = true
    api.auth
      .currentUser()
      .then((profile) => {
        if (active) updateUser(profile)
      })
      .catch((error: unknown) => {
        // Uma sessão ausente é normal para visitantes; outros erros também
        // deixam o app navegável, e a próxima ação autenticada exibirá o erro.
        if (error instanceof ApiError && error.status !== 401 && error.status !== 403) {
          console.error('Falha ao carregar a sessão CultHub.', error)
        }
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [updateUser])

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (data) => {
      const profile = await api.auth.signUp(data)
      updateUser(profile)
      return profile
    },
    [updateUser],
  )

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (data) => {
      const profile = await api.auth.signIn(data)
      updateUser(profile)
      return profile
    },
    [updateUser],
  )

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signUp, signIn, signOut, updateUser }),
    [user, loading, signUp, signIn, signOut, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
