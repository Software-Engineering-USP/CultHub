import { categories } from '@/lib/categories'
import type { CategoryId, CultEvent } from '@/types'

interface FaixaPrecoApi {
  moeda: string
  minimo: number | null
  maximo: number | null
}

interface EventoApi {
  id: string
  titulo: string
  descricao: string
  categorias: string[]
  url_externa: string
  data_inicio: string
  inicio: string | null
  fuso: string
  local: {
    nome: string
    cidade: string
    latitude: number | null
    longitude: number | null
  } | null
  gratuito: boolean
  situacao_preco: 'gratuito' | 'pago' | 'desconhecido'
  faixas_preco: FaixaPrecoApi[]
  imagens: { url: string }[]
}

interface PaginaEventosApi {
  count: number
  next: string | null
  results: EventoApi[]
}

export interface PaginaEventos {
  count: number
  hasMore: boolean
  events: CultEvent[]
}

const TAMANHO_PAGINA = 100

function isCategoryId(value: string): value is CategoryId {
  return value in categories
}

function schedule(event: EventoApi): string {
  const withTime = Boolean(event.inicio)
  const date = event.inicio ? new Date(event.inicio) : new Date(`${event.data_inicio}T00:00:00Z`)

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    ...(withTime && { hour: '2-digit', minute: '2-digit' }),
    timeZone: withTime ? event.fuso : 'UTC',
  }).format(date)
}

function price(event: EventoApi): { label: string; value: number | null } {
  if (event.gratuito || event.situacao_preco === 'gratuito') {
    return { label: 'Gratuito', value: 0 }
  }

  const faixa = event.faixas_preco.find((item) => item.minimo !== null || item.maximo !== null)
  const value = faixa?.minimo ?? faixa?.maximo ?? null
  if (!faixa || value === null) {
    return { label: 'Preço não informado', value: null }
  }

  const moeda = /^[A-Z]{3}$/.test(faixa.moeda) ? faixa.moeda : 'BRL'
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: moeda,
  }).format(value)
  return {
    label: faixa.minimo === null ? `Até ${formatted}` : `A partir de ${formatted}`,
    value,
  }
}

function adaptEvent(event: EventoApi): CultEvent {
  const eventPrice = price(event)
  return {
    id: event.id,
    title: event.titulo,
    category: event.categorias.find(isCategoryId) ?? 'other',
    description: event.descricao || 'Mais informações sobre este evento em breve.',
    venue: event.local
      ? [event.local.nome, event.local.cidade].filter(Boolean).join(' · ')
      : 'Local a confirmar',
    schedule: schedule(event),
    price: eventPrice.label,
    priceValue: eventPrice.value,
    image: event.imagens[0]?.url ?? '',
    imageAlt: `Imagem de ${event.titulo}`,
    externalUrl: event.url_externa || undefined,
  }
}

export async function buscarEventos(page: number, signal?: AbortSignal): Promise<PaginaEventos> {
  const query = new URLSearchParams({ page: String(page), tamanho: String(TAMANHO_PAGINA) })
  const response = await fetch(`/api/eventos/?${query}`, { signal })
  if (!response.ok) {
    throw new Error('Não foi possível carregar os eventos. Tente novamente.')
  }

  const data = (await response.json()) as PaginaEventosApi
  return {
    count: data.count,
    hasMore: data.next !== null,
    events: data.results.map(adaptEvent),
  }
}
