import { createContext } from 'react'
import type { api, ProfileResponse } from '@/services/api'
import type { User } from '@/types'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  signUp: typeof api.auth.signUp
  signIn: typeof api.auth.signIn
  signOut: () => Promise<void>
  updateUser: (profile: ProfileResponse) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
