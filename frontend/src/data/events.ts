import type { CategoryId } from '../lib/categories'

// Dados demonstrativos extraídos das páginas estáticas (pasta foo).
// Quando o backend expor uma API, basta trocar estas constantes por chamadas.

export interface EventDetails {
  about: string[]
  startTime: string
}

export interface CultEvent {
  id: string
  title: string
  /** Nome curto usado em breadcrumbs e selos */
  shortTitle?: string
  category: CategoryId
  description: string
  venue: string
  schedule: string
  price: string
  /** Caminho em public/assets */
  image: string
  imageAlt: string
  featured?: boolean
  /** Só eventos com detalhes têm página própria */
  details?: EventDetails
}

export const events: CultEvent[] = [
  {
    id: 'sp-jazz-blues-festival',
    title: 'São Paulo Jazz & Blues Festival',
    shortTitle: 'Jazz & Blues',
    category: 'music',
    description:
      'Os maiores nomes do Jazz nacional e internacional reunidos em uma noite inesquecível de improvisação e arte.',
    venue: 'Auditório Ibirapuera',
    schedule: 'Sexta, 19:00',
    price: 'R$ 120,00',
    image: '/assets/jazz-source.png',
    imageAlt: 'Apresentação de jazz ao vivo em palco com iluminação quente',
    featured: true,
    details: {
      startTime: '19:00',
      about: [
        'Os maiores nomes do Jazz nacional e internacional reunidos em uma noite inesquecível de improvisação e arte.',
        'Uma noite para mergulhar no universo do jazz e do blues, descobrir novos sons e compartilhar a experiência com quem também vive a música.',
      ],
    },
  },
  {
    id: 'fantasma-da-opera',
    title: 'O Fantasma da Ópera - Espetáculo',
    category: 'theater',
    description:
      'O clássico espetáculo da Broadway em uma superprodução inédita no Brasil com orquestra completa ao vivo.',
    venue: 'Teatro Renault',
    schedule: 'Sábado, 20:30',
    price: 'R$ 250,00',
    image: '/assets/teatro.png',
    imageAlt: 'Cena teatral de O Fantasma da Ópera',
    featured: true,
  },
  {
    id: 'van-gogh-imersivo',
    title: 'Van Gogh Imersivo 360°',
    category: 'art',
    description:
      'Uma experiência sensorial e projeções gigantes em 360 graus pelas obras mais emblemáticas do mestre holandês.',
    venue: 'MASP - Av. Paulista',
    schedule: 'Dom, 10:00 - 22:00',
    price: 'R$ 80,00',
    image: '/assets/van-gogh.png',
    imageAlt: 'Projeção imersiva de pinturas de Van Gogh',
    featured: true,
  },
  {
    id: 'derby-paulista',
    title: 'Derby Paulista: COR x PAL',
    category: 'sport',
    description: 'O clássico mais disputado da cidade em uma tarde decisiva repleta de emoção no campeonato.',
    venue: 'Neo Química Arena',
    schedule: 'Domingo, 16:00',
    price: 'A partir de R$ 90',
    image: '/assets/futebol.png',
    imageAlt: 'Estádio de futebol durante uma partida',
    featured: true,
  },
  {
    id: 'virada-cultural',
    title: 'Virada Cultural SP 24h',
    category: 'festival',
    description:
      '24 horas ininterruptas de shows, intervenções artísticas, teatro de rua e gastronomia pelo centro.',
    venue: 'Vale do Anhangabaú',
    schedule: 'Sábado e Domingo',
    price: 'Gratuito',
    image: '/assets/virada.png',
    imageAlt: 'Público reunido para um show da Virada Cultural',
    featured: true,
  },
  {
    id: 'samba-feijoada-bixiga',
    title: 'Samba e Feijoada no Bixiga',
    category: 'music',
    description:
      'A mais tradicional roda de samba raiz de São Paulo, com muita alegria, dança e comida típica ao ar livre.',
    venue: 'Praça Dom Orione',
    schedule: 'Sábado, 15:00',
    price: 'Gratuito',
    image: '/assets/samba.png',
    imageAlt: 'Roda de samba ao ar livre no Bixiga',
  },
  {
    id: 'sp-arte',
    title: 'SP-Arte: Feira Internacional',
    category: 'art',
    description:
      'O maior encontro de galerias de arte contemporânea, curadores e artistas renomados da América Latina.',
    venue: 'Pavilhão da Bienal',
    schedule: 'Qui a Dom, 11:00',
    price: 'R$ 50,00',
    image: '/assets/arte.png',
    imageAlt: 'Exposição de arte contemporânea em uma galeria',
  },
  {
    id: 'street-food-truck-fair',
    title: 'Street Food & Truck Fair',
    category: 'festival',
    description: 'Mais de 40 food trucks servindo o melhor da culinária de rua mundial com DJs ao vivo.',
    venue: 'Praça Charles Miller',
    schedule: 'Sexta, 18:00',
    price: 'Gratuito',
    image: '/assets/food.png',
    imageAlt: 'Food trucks e mesas de uma feira gastronômica',
  },
]

export function findEvent(id: string): CultEvent | undefined {
  return events.find((event) => event.id === id)
}

export const currentUser = {
  name: 'Lívia Costa',
  initials: 'LC',
  email: 'livia.costa@exemplo.com',
  city: 'São Paulo, SP',
  district: 'Vila Mariana',
  preferences: ['music', 'art'] as CategoryId[],
  savedEventIds: ['sp-jazz-blues-festival', 'van-gogh-imersivo'],
}

export interface EventComment {
  id: string
  author: string
  initials: string
  text: string
}

export const demoComments: EventComment[] = [
  {
    id: 'c1',
    author: 'Lívia Costa',
    initials: 'LC',
    text: 'Jazz ao vivo no Ibirapuera é uma combinação que eu adoro. Salvei para planejar a sexta com os amigos.',
  },
  {
    id: 'c2',
    author: 'Rafael Martins',
    initials: 'RM',
    text: 'Gostei da proposta! Quero conhecer mais sobre os artistas e a programação antes de decidir.',
  },
]

export interface RouteOption {
  id: 'carro' | 'onibus' | 'ape'
  label: string
  time: string
  detail: string
  tag: string
}

export const demoRoutes: RouteOption[] = [
  { id: 'carro', label: 'Carro', time: '12 min', detail: '6,4 km', tag: 'Mais rápido' },
  { id: 'onibus', label: 'Ônibus', time: '24 min', detail: '2 trocas', tag: 'Econômico' },
  { id: 'ape', label: 'A pé', time: '34 min', detail: '2,8 km', tag: 'Ativo' },
]

export const demoWeather = {
  condition: 'Poucas nuvens',
  temperature: '22°C',
  feelsLike: '20°C',
  humidity: '58%',
  wind: '12 km/h',
}
