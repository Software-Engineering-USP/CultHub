import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/types'

/** Usuário autenticado na sessão atual; null para visitantes. */
export function useCurrentUser(): User | null {
  return useAuth().user
}
