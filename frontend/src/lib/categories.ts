export type CategoryId = 'music' | 'festival' | 'theater' | 'sport' | 'art'

interface CategoryStyle {
  label: string
  /** Cor de fundo do card do evento */
  card: string
  /** Cor da bolinha na legenda/filtros */
  dot: string
}

// As classes precisam aparecer por extenso para o Tailwind gerá-las.
export const categories: Record<CategoryId, CategoryStyle> = {
  music: { label: 'Música', card: 'bg-cat-music', dot: 'bg-dot-music' },
  festival: { label: 'Festivais', card: 'bg-cat-festival', dot: 'bg-dot-festival' },
  theater: { label: 'Teatro', card: 'bg-cat-theater', dot: 'bg-dot-theater' },
  sport: { label: 'Esportes', card: 'bg-cat-sport', dot: 'bg-dot-sport' },
  art: { label: 'Artes', card: 'bg-cat-art', dot: 'bg-dot-art' },
}

/** Ordem usada na legenda do mapa e no popover de filtros. */
export const categoryOrder: CategoryId[] = ['music', 'festival', 'theater', 'sport', 'art']
