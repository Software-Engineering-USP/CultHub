export type CategoryId = 'music' | 'festival' | 'theater' | 'sport' | 'art'

export interface EventDetails {
  about: string[]
  startTime: string
}

export type EventAvailability = 'removed' | 'cancelled' | 'ended'

export interface CultEvent {
  id: string
  title: string
  /** Nome curto usado em breadcrumbs e selos */
  shortTitle?: string
  category: CategoryId
  description: string
  venue: string
  schedule: string
  /* Preço em texto para exibição na UI */
  price: string
  priceValue: number
  /** Caminho em public/assets */
  image: string
  imageAlt: string
  featured?: boolean
  /** Situação que torna o evento indisponível para uma nova visita. */
  availability?: EventAvailability
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
  temperature: string
  feelsLike: string
  humidity: string
  wind: string
}
