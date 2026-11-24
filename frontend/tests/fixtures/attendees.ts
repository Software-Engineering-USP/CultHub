import type { ApiAttendee } from '@/services/api'

export function apiAttendee(overrides: Partial<ApiAttendee> = {}): ApiAttendee {
  return { id: 'rafael-martins', nome: 'Rafael Martins', iniciais: 'RM', ...overrides }
}
