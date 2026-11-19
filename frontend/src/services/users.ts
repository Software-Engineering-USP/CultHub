import type { ApiPublicProfile } from '@/services/api'
import type { PublicProfile } from '@/types'

export function toPublicProfile(profile: ApiPublicProfile): PublicProfile {
  return {
    id: profile.id,
    name: profile.nome,
    initials: profile.iniciais,
    city: profile.cidade,
    preferences: profile.preferencias,
    memberSince: profile.membro_desde,
  }
}

/** Mês e ano do cadastro, ex.: "novembro de 2026". A data vem sem hora, então é lida em UTC. */
export function formatMemberSince(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}
