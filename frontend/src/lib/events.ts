import type { CultEvent, EventAvailability } from '@/types'

/** Nome curto (breadcrumbs, selos), com fallback para o título. */
export function shortName(event: CultEvent): string {
  return event.shortTitle ?? event.title
}

/** Selo de evento que não vai mais acontecer; encerrados não têm selo, já que a data diz isso. */
export function unavailableLabel(event: CultEvent): string | undefined {
  const labels: Partial<Record<EventAvailability, string>> = { removed: 'Removido', cancelled: 'Cancelado' }
  return event.availability && labels[event.availability]
}
