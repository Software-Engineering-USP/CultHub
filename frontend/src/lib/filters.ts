import { categoryOrder } from '@/lib/categories'
import type { CategoryId, CultEvent } from '@/types'

export type PriceMode = 'all' | 'free' | 'paid'

export interface EventFilters {
  categories: CategoryId[]
  price: PriceMode
  /** Faixa de preço em reais; não se aplica quando price é 'free' */
  minPrice: number
  maxPrice: number
}

/** Filtros iniciais: todas as categorias, qualquer preço, faixa inteira. */
export function defaultFilters(ceiling: number): EventFilters {
  return { categories: [...categoryOrder], price: 'all', minPrice: 0, maxPrice: ceiling }
}

export function matchesFilters(event: CultEvent, filters: EventFilters): boolean {
  if (!filters.categories.includes(event.category)) return false
  if (filters.price === 'free') return event.priceValue === 0
  if (filters.price === 'paid' && event.priceValue === 0) return false
  return event.priceValue >= filters.minPrice && event.priceValue <= filters.maxPrice
}
