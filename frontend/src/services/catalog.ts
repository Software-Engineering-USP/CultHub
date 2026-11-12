import type { CategoryId, EventAvailability, EventWithDetails } from '@/types'

const knownCategories = new Set<CategoryId>(['music', 'festival', 'theater', 'sport', 'art'])

export interface ApiCategory {
  codigo: CategoryId
  nome: string
}

export interface ApiEvent {
  id: string
  titulo: string
  descricao: string
  genero: string
  categorias: CategoryId[]
  data_inicio: string
  hora_inicio: string | null
  inicio: string | null
  fim: string | null
  data_fim: string | null
  hora_fim: string | null
  fuso: string
  local: {
    nome: string
    endereco: string
    cidade: string
    estado: string
    latitude?: number | null
    longitude?: number | null
  } | null
  situacao_preco: 'gratuito' | 'pago' | 'desconhecido'
  faixas_preco: { minimo: number | null; maximo: number | null; moeda: string }[]
  imagens: { url: string; proporcao: string; largura: number | null; altura: number | null }[]
  avisos?: string
  situacao?: string
  removido?: boolean
  salvo?: boolean
  presenca?: boolean
  total_presencas?: number
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CatalogQuery {
  q?: string
  categorias?: CategoryId[]
  preco?: 'gratuito' | 'pago' | 'desconhecido'
  page?: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'include', signal })
  if (!response.ok) {
    let message = 'Falha ao carregar o catálogo.'
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object') message = Object.values(body).flat().join(' ')
    } catch {
      // Mantém a mensagem HTTP quando a resposta não contém JSON.
    }
    throw new ApiError(`${message} (${response.status})`, response.status)
  }
  return response.json() as Promise<T>
}

export const catalogApi = {
  categories: () => get<ApiCategory[]>('/categorias/'),
  events: (query: CatalogQuery = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (query.q?.trim()) params.set('q', query.q.trim())
    if (query.categorias?.length) params.set('categorias', query.categorias.join(','))
    if (query.preco) params.set('preco', query.preco)
    if (query.page && query.page > 1) params.set('page', String(query.page))
    const suffix = params.size ? `?${params.toString()}` : ''
    return get<Paginated<ApiEvent>>(`/eventos/${suffix}`, signal)
  },
  event: (id: string, signal?: AbortSignal) => get<ApiEvent>(`/eventos/${encodeURIComponent(id)}/`, signal),
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatPrice(event: ApiEvent): { price: string; priceValue: number } {
  if (event.situacao_preco === 'gratuito') return { price: 'Gratuito', priceValue: 0 }
  const values = event.faixas_preco
    .flatMap((range) => [range.minimo, range.maximo])
    .filter((value): value is number => value !== null)
  if (event.situacao_preco === 'desconhecido' || !values.length) {
    return { price: 'Preço não informado', priceValue: 0 }
  }
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  return {
    price: maximum > minimum ? `A partir de ${currency.format(minimum)}` : currency.format(minimum),
    priceValue: minimum,
  }
}

function formatSchedule(event: ApiEvent): string {
  const [year, month, day] = event.data_inicio.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  if (!event.hora_inicio) return dateLabel
  return `${dateLabel}, ${event.hora_inicio.slice(0, 5)}`
}

function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts()
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

function availability(event: ApiEvent): EventAvailability | undefined {
  if (event.removido) return 'removed'
  if (event.situacao?.toLowerCase() === 'cancelled' || event.situacao?.toLowerCase() === 'canceled') {
    return 'cancelled'
  }
  if (
    event.fim
      ? new Date(event.fim).getTime() < Date.now()
      : (event.data_fim ?? event.data_inicio) < todayInTimeZone(event.fuso)
  ) {
    return 'ended'
  }
  return undefined
}

export function toCultEvent(event: ApiEvent): EventWithDetails {
  const category = event.categorias.find((value) => knownCategories.has(value)) ?? 'art'
  const image = event.imagens[0]
  const venue = event.local?.nome || 'Local a confirmar'
  const latitude = event.local?.latitude
  const longitude = event.local?.longitude
  const { price, priceValue } = formatPrice(event)
  return {
    id: event.id,
    title: event.titulo,
    shortTitle: event.titulo,
    category,
    description: event.descricao || 'Mais informações sobre este evento em breve.',
    venue,
    location:
      typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : undefined,
    schedule: formatSchedule(event),
    price,
    priceValue,
    image: image?.url ?? '/assets/event-placeholder.svg',
    imageAlt: `Imagem do evento ${event.titulo}`,
    saved: event.salvo ?? false,
    attending: event.presenca ?? false,
    attendanceCount: event.total_presencas ?? 0,
    availability: availability(event),
    details: {
      about: [event.descricao || 'Mais informações sobre este evento em breve.'],
      startTime: event.hora_inicio?.slice(0, 5) ?? 'Horário a confirmar',
    },
  }
}
