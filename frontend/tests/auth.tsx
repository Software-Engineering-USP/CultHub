import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/auth-context'
import { currentUser } from '@/data/user'
import { api } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import type { User } from '@/types'

function userFromProfile(profile: ProfileResponse): User {
  return {
    id: profile.id,
    name: profile.nome,
    initials: profile.iniciais,
    email: profile.email,
    city: profile.cidade,
    district: profile.bairro,
    preferences: profile.preferencias,
    savedEventIds: [],
  }
}

export function AuthTestProvider({
  children,
  initialUser = currentUser,
}: Readonly<{ children: ReactNode; initialUser?: User | null }>) {
  const [user, setUser] = useState<User | null>(initialUser)
  const updateUser = useCallback((profile: ProfileResponse) => setUser(userFromProfile(profile)), [])

  const signUp: AuthContextValue['signUp'] = useCallback(
    async (data) => {
      const profile = await api.auth.signUp(data)
      updateUser(profile)
      return profile
    },
    [updateUser],
  )
  const signIn: AuthContextValue['signIn'] = useCallback(
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
    () => ({ user, loading: false, signUp, signIn, signOut, updateUser }),
    [user, signUp, signIn, signOut, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
