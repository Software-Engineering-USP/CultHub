export type CategoryId = 'music' | 'festival' | 'theater' | 'sport' | 'art'

export interface EventDetails {
  about: string[]
  startTime: string
}

export type EventAvailability = 'removed' | 'cancelled' | 'ended'

/** Ponto em WGS84, no padrão do backend (`latitude`/`longitude`). */
export interface Coordinates {
  latitude: number
  longitude: number
}

/** Ponto de partida da rota: a coordenada do pino e, se conhecido, o endereço legível. */
export interface RouteOrigin extends Coordinates {
  label: string | null
}

export interface CultEvent {
  id: string
  title: string
  /** Nome curto usado em breadcrumbs e selos */
  shortTitle?: string
  category: CategoryId
  description: string
  venue: string
  /** Coordenadas do local, quando o catálogo as conhece */
  location?: Coordinates
  schedule: string
  /** Data de início (AAAA-MM-DD), quando o evento vem do catálogo */
  startDate?: string
  /* Preço em texto para exibição na UI */
  price: string
  priceValue: number
  /** Caminho em public/assets */
  image: string
  imageAlt: string
  featured?: boolean
  saved?: boolean
  attending?: boolean
  attendanceCount?: number
  /** Situação que torna o evento indisponível para uma nova visita. */
  availability?: EventAvailability
  /** Dados do evento usados para consultar a previsão do tempo no local e horário. */
  weatherLocation?: {
    latitude: number | null
    longitude: number | null
    city: string
  }
  eventDate?: string
  eventTime?: string | null
  /** Só eventos com detalhes têm página própria */
  details?: EventDetails
}

/** Evento com página própria (detalhes, origem e rota). */
export type EventWithDetails = CultEvent & { details: EventDetails }

export interface User {
  id: string
  name: string
  initials: string
  email: string
  city: string
  district: string
  preferences: CategoryId[]
  savedEventIds: string[]
}

export interface EventComment {
  id: string
  eventId: string
  authorId: string
  author: string
  initials: string
  text: string
}

export interface RouteOption {
  id: 'carro' | 'onibus' | 'ape'
  label: string
  time: string
  detail: string
  tag: string
}

export interface Weather {
  condition: string
  iconSlug: string
  theme: 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'
  temperature: string
  feelsLike?: string
  humidity?: string
  wind?: string
  precipitation?: string
  forecastType: 'hourly' | 'daily'
}
