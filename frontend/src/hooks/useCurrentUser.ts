import { currentUser } from '@/data/user'
import type { User } from '@/types'

/** Usuário logado (por enquanto, o perfil fictício da demonstração). */
export function useCurrentUser(): User {
  return currentUser
}
