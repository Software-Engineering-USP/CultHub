import type { CultEvent, EventAvailability } from '@/types'

/** Nome curto (breadcrumbs, selos), com fallback para o título. */
export function shortName(event: CultEvent): string {
  return event.shortTitle ?? event.title
}

/** Indica quando o preço indisponível deve direcionar à página oficial do evento. */
export function showsOfficialLink(event: Pick<CultEvent, 'priceStatus' | 'officialUrl'>): boolean {
  return event.priceStatus === 'desconhecido' && Boolean(event.officialUrl)
}

/** Selo de evento que não vai mais acontecer; encerrados não têm selo, já que a data diz isso. */
export function unavailableLabel(event: CultEvent): string | undefined {
  const labels: Partial<Record<EventAvailability, string>> = { removed: 'Removido', cancelled: 'Cancelado' }
  return event.availability && labels[event.availability]
}
