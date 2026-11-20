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
  /** Endereço, cidade e estado do local, quando o catálogo informa */
  venueAddress?: string
  /** Coordenadas do local, quando o catálogo as conhece */
  location?: Coordinates
  schedule: string
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
  eventStartsAt?: string | null
  eventEndDate?: string | null
  eventEndTime?: string | null
  eventEndsAt?: string | null
  eventTimezone?: string
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

/** Perfil público de outra pessoa. */
export interface PublicProfile {
  id: string
  name: string
  initials: string
  /** Vazia quando a pessoa não informou. */
  city: string
  preferences: CategoryId[]
  /** Data do cadastro, AAAA-MM-DD. */
  memberSince: string
}

export interface CommentAuthor {
  id: string
  name: string
  initials: string
}

/** Comentário de um evento, com as respostas aninhadas. */
export interface EventComment {
  id: string
  eventId: string
  parentId: string | null
  /** 0 para comentário, 1 para resposta... */
  level: number
  /** null quando removido. */
  author: CommentAuthor | null
  /** null quando removido. */
  text: string | null
  createdAt: string
  editedAt: string | null
  removed: boolean
  /** Escrito pelo usuário logado. */
  mine: boolean
  replies: EventComment[]
}

/** Comentário (ou resposta) do usuário logado, com o evento de onde veio. */
export interface MyComment {
  id: string
  event: { id: string; title: string }
  parentId: string | null
  level: number
  text: string
  createdAt: string
  editedAt: string | null
}

export type RouteMode = 'carro' | 'onibus' | 'ape'

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
  eventInProgress?: boolean
  forecastTimeZone?: string
}
