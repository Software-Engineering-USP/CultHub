import type { CategoryId, EventAvailability, EventWithDetails } from '@/types'
import { AUTHENTICATION_FAILURE_EVENT } from './api'

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
  /** Período (AAAA-MM-DD); entram os eventos que acontecem em algum dia dele */
  de?: string
  ate?: string
  lat?: number
  lng?: number
  raio?: number
  tamanho?: number
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

/** Texto de erro enviado pelo backend no corpo JSON, ou `null` se não houver. */
async function errorDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') return Object.values(body).flat().join(' ') || null
  } catch {
    // Resposta sem JSON: fica a mensagem padrão.
  }
  return null
}

/**
 * GET em `/api{path}` com a sessão. Respostas não-2xx viram `ApiError`, com a mensagem
 * montada por `describe` a partir do status e do detalhe enviado pelo backend.
 */
export async function apiGet<T>(
  path: string,
  { signal, describe }: { signal?: AbortSignal; describe: (status: number, detail: string | null) => string },
): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'include', signal })
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTHENTICATION_FAILURE_EVENT))
    }
    throw new ApiError(describe(response.status, await errorDetail(response)), response.status)
  }
  return response.json() as Promise<T>
}

function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiGet<T>(path, {
    signal,
    describe: (status, detail) => `${detail ?? 'Falha ao carregar o catálogo.'} (${status})`,
  })
}

export const catalogApi = {
  categories: () => get<ApiCategory[]>('/categorias/'),
  events: (query: CatalogQuery = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (query.q?.trim()) params.set('q', query.q.trim())
    if (query.categorias?.length) params.set('categorias', query.categorias.join(','))
    if (query.preco) params.set('preco', query.preco)
    if (query.de) params.set('de', query.de)
    if (query.ate) params.set('ate', query.ate)
    if (query.lat !== undefined && query.lng !== undefined && query.raio !== undefined) {
      params.set('lat', String(query.lat))
      params.set('lng', String(query.lng))
      params.set('raio', String(query.raio))
    }
    if (query.tamanho !== undefined) params.set('tamanho', String(query.tamanho))
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

export function dateTimeInTimeZone(date: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  }
}

function todayInTimeZone(timeZone: string): string {
  return dateTimeInTimeZone(new Date(), timeZone).date
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

export function toCultEvent(event: ApiEvent, preferredCategory?: CategoryId): EventWithDetails {
  const category =
    (preferredCategory && event.categorias.includes(preferredCategory) ? preferredCategory : undefined) ??
    event.categorias.find((value) => knownCategories.has(value)) ??
    'art'
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
    venueAddress:
      [event.local?.endereco, event.local?.cidade, event.local?.estado].filter(Boolean).join(', ') ||
      undefined,
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
    weatherLocation: event.local
      ? {
          latitude: event.local.latitude ?? null,
          longitude: event.local.longitude ?? null,
          city: event.local.cidade,
        }
      : undefined,
    eventDate: event.data_inicio,
    eventTime: event.hora_inicio,
    eventStartsAt: event.inicio,
    eventEndDate: event.data_fim,
    eventEndTime: event.hora_fim,
    eventEndsAt: event.fim,
    eventTimezone: event.fuso,
    details: {
      about: [event.descricao || 'Mais informações sobre este evento em breve.'],
      startTime: event.hora_inicio?.slice(0, 5) ?? 'Horário a confirmar',
    },
  }
}
