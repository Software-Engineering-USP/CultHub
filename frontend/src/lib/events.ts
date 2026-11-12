import type { CultEvent } from '@/types'

/** Nome curto (breadcrumbs, selos), com fallback para o título. */
export function shortName(event: CultEvent): string {
  return event.shortTitle ?? event.title
}

/** Teto da faixa de preço dos filtros: o maior preço, arredondado para cima de 50 em 50. */
export function maxPrice(events: CultEvent[]): number {
  const highest = Math.max(0, ...events.map((event) => event.priceValue ?? 0))
  return Math.ceil(highest / 50) * 50
}
