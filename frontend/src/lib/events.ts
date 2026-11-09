import type { CultEvent, EventWithDetails } from '@/types'

/** Nome curto (breadcrumbs, selos), com fallback para o título. */
export function shortName(event: CultEvent): string {
  return event.shortTitle ?? event.title
}

/** Se o evento existe e tem página própria nesta demonstração. */
export function hasDetails(event: CultEvent | undefined): event is EventWithDetails {
  return event?.details !== undefined
}

/** Teto da faixa de preço dos filtros: o maior preço, arredondado para cima de 50 em 50. */
export function maxPrice(events: CultEvent[]): number {
  const highest = Math.max(0, ...events.map((event) => event.priceValue))
  return Math.ceil(highest / 50) * 50
}
