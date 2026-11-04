import type { CategoryId } from '@/types'

interface CategoryStyle {
  label: string
  /** Cor de fundo do card do evento */
  card: string
  /** Cor da bolinha na legenda/filtros */
  dot: string
  /** Cor da caixa de seleção marcada (painel de filtros) */
  checkbox: string
}

// As classes precisam aparecer por extenso para o Tailwind gerá-las.
export const categories: Record<CategoryId, CategoryStyle> = {
  music: {
    label: 'Música',
    card: 'bg-cat-music',
    dot: 'bg-dot-music',
    checkbox: 'data-[state=checked]:border-dot-music data-[state=checked]:bg-dot-music',
  },
  festival: {
    label: 'Festivais',
    card: 'bg-cat-festival',
    dot: 'bg-dot-festival',
    checkbox: 'data-[state=checked]:border-dot-festival data-[state=checked]:bg-dot-festival',
  },
  theater: {
    label: 'Teatro',
    card: 'bg-cat-theater',
    dot: 'bg-dot-theater',
    checkbox: 'data-[state=checked]:border-dot-theater data-[state=checked]:bg-dot-theater',
  },
  sport: {
    label: 'Esportes',
    card: 'bg-cat-sport',
    dot: 'bg-dot-sport',
    checkbox: 'data-[state=checked]:border-dot-sport data-[state=checked]:bg-dot-sport',
  },
  art: {
    label: 'Artes',
    card: 'bg-cat-art',
    dot: 'bg-dot-art',
    checkbox: 'data-[state=checked]:border-dot-art data-[state=checked]:bg-dot-art',
  },
}

/** Ordem usada na legenda do mapa e no painel de filtros. */
export const categoryOrder: CategoryId[] = ['music', 'festival', 'theater', 'sport', 'art']
