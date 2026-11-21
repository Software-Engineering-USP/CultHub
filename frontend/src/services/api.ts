import type { ApiEvent, Paginated } from '@/services/catalog'
import type { CategoryId } from '@/types'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export const AUTHENTICATION_FAILURE_EVENT = 'culthub:authentication-failure'

export interface ProfileResponse {
  id: string
  nome: string
  email: string
  cidade: string
  bairro: string
  preferencias: CategoryId[]
  iniciais: string
}

/** O que outra pessoa logada vê de um usuário (sem e-mail nem bairro). */
export interface ApiPublicProfile {
  id: string
  nome: string
  iniciais: string
  /** Pode vir vazia. */
  cidade: string
  preferencias: CategoryId[]
  /** Só a data do cadastro, AAAA-MM-DD. */
  membro_desde: string
}

export interface ApiComment {
  id: string
  evento: string
  resposta_a: string | null
  nivel: number
  /** null quando o comentário foi removido. */
  autor: { id: string; nome: string; iniciais: string } | null
  texto: string | null
  criado_em: string
  editado_em: string | null
  removido: boolean
  /** Escrito pelo usuário logado (e não removido). */
  meu: boolean
  respostas: ApiComment[]
}

export interface ApiMyComment {
  id: string
  evento: { id: string; titulo: string }
  resposta_a: string | null
  nivel: number
  texto: string
  criado_em: string
  editado_em: string | null
}

export type ApiNotificationType = 'lembrete' | 'evento_novo'

export interface ApiNotification {
  id: string
  tipo: ApiNotificationType
  evento_id: string
  titulo_evento: string
  data_inicio: string
  hora_inicio: string | null
  local: string
  criada_em: string
  lida_em: string | null
}

export interface NotificationsResponse {
  nao_lidas: number
  resultados: ApiNotification[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function csrfCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('csrftoken='))
    ?.slice('csrftoken='.length)
}

function errorMessage(data: unknown): string {
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    const messages = entries.flatMap(([field, value]) => {
      const values = Array.isArray(value) ? value : [value]
      return values.map((message) => {
        const label = field === 'detail' || field === 'non_field_errors' ? '' : `${field}: `
        return typeof message === 'string' ? `${label}${message}` : ''
      })
    })
    if (messages.length) return messages.join(' ')
  }
  return 'Não foi possível concluir a solicitação. Tente novamente.'
}

async function apiRequest<T>(path: string, method: Method = 'GET', body?: object): Promise<T> {
  if (method !== 'GET' && !csrfCookie()) {
    await fetch('/api/auth/csrf/', { credentials: 'same-origin' })
  }
  const csrf = csrfCookie()
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(csrf && { 'X-CSRFToken': decodeURIComponent(csrf) }),
    },
    ...(body && { body: JSON.stringify(body) }),
  })
  const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    const isAuthenticationError = response.status === 401 || response.status === 403
    const isSessionLookup = path === '/eu/' && method === 'GET'
    const isAuthenticationEndpoint = path.startsWith('/auth/')
    if (
      isAuthenticationError &&
      !isSessionLookup &&
      !isAuthenticationEndpoint &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new Event(AUTHENTICATION_FAILURE_EVENT))
    }
    throw new ApiError(errorMessage(data), response.status)
  }
  return data as T
}

function notifyNotificationsChanged(eventId: string) {
  if (typeof window !== 'undefined') {
    const notificationEvent = new CustomEvent('culthub:notifications-updated', {
      detail: { eventId },
    })
    window.dispatchEvent(notificationEvent)
  }
}

export type AttendanceWhen = 'futuras' | 'passadas'

function listPath(path: string, filters: Record<string, string>, page: number): string {
  const params = new URLSearchParams(filters)
  if (page > 1) params.set('page', String(page))
  return params.size ? `${path}?${params.toString()}` : path
}

export const api = {
  auth: {
    signUp: (data: { name: string; email: string; password: string; acceptedTerms: boolean }) =>
      apiRequest<ProfileResponse>('/auth/cadastro/', 'POST', {
        nome: data.name,
        email: data.email,
        senha: data.password,
        aceite_termos: data.acceptedTerms,
      }),
    signIn: (data: { email: string; password: string; remember: boolean }) =>
      apiRequest<ProfileResponse>('/auth/entrar/', 'POST', {
        email: data.email,
        senha: data.password,
        lembrar: data.remember,
      }),
    signOut: () => apiRequest<void>('/auth/sair/', 'POST'),
    requestPasswordReset: (email: string) =>
      apiRequest<{ detail: string }>('/auth/recuperar-senha/', 'POST', { email }),
    resetPassword: (data: { uid: string; token: string; password: string }) =>
      apiRequest<{ detail: string }>('/auth/redefinir-senha/', 'POST', {
        uid: data.uid,
        token: data.token,
        senha: data.password,
      }),
    currentUser: () => apiRequest<ProfileResponse>('/eu/'),
  },

  profile: {
    /** O e-mail não é editável no backend, então não é enviado. */
    update: (data: { name: string; city: string; district: string }) =>
      apiRequest<ProfileResponse>('/eu/', 'PATCH', {
        nome: data.name,
        cidade: data.city,
        bairro: data.district,
      }),
    updatePreferences: (categories: CategoryId[]) =>
      apiRequest<ProfileResponse>('/eu/', 'PATCH', { preferencias: categories }),
  },

  users: {
    /** Perfil público; exige login. 404 se não existe ou a conta foi desativada. */
    profile: (id: string) => apiRequest<ApiPublicProfile>(`/usuarios/${encodeURIComponent(id)}/`),
  },

  agenda: {
    savedEvents: (page = 1) => apiRequest<Paginated<ApiEvent>>(listPath('/eu/salvos/', {}, page)),
    /** Eventos com presença marcada: futuros (do mais próximo) ou passados (do mais recente). */
    attendances: (when: AttendanceWhen, page = 1) =>
      apiRequest<Paginated<ApiEvent>>(listPath('/eu/presencas/', { quando: when }, page)),
    /** Salvos e presenças que acontecem no período (datas AAAA-MM-DD, até 366 dias). */
    calendar: (from: string, to: string, page = 1) =>
      apiRequest<Paginated<ApiEvent>>(listPath('/eu/agenda/', { de: from, ate: to }, page)),
  },

  notifications: {
    list: () => apiRequest<NotificationsResponse>('/eu/notificacoes/'),
    markRead: (id: string) => apiRequest<void>(`/notificacoes/${encodeURIComponent(id)}/ler/`, 'PATCH'),
    markAllRead: () => apiRequest<void>('/eu/notificacoes/ler-todas/', 'POST'),
  },

  events: {
    save: async (eventId: string) => {
      await apiRequest<void>(`/eventos/${encodeURIComponent(eventId)}/salvar/`, 'POST')
      notifyNotificationsChanged(eventId)
    },
    unsave: (eventId: string) =>
      apiRequest<void>(`/eventos/${encodeURIComponent(eventId)}/salvar/`, 'DELETE'),
    attend: async (eventId: string) => {
      await apiRequest<void>(`/eventos/${encodeURIComponent(eventId)}/presenca/`, 'POST')
      notifyNotificationsChanged(eventId)
    },
    unattend: (eventId: string) =>
      apiRequest<void>(`/eventos/${encodeURIComponent(eventId)}/presenca/`, 'DELETE'),
  },

  comments: {
    /** Comentários do evento, do mais recente, com as respostas aninhadas. */
    list: (eventId: string, page = 1) =>
      apiRequest<Paginated<ApiComment>>(
        listPath(`/eventos/${encodeURIComponent(eventId)}/comentarios/`, {}, page),
      ),
    create: (eventId: string, text: string) =>
      apiRequest<ApiComment>(`/eventos/${encodeURIComponent(eventId)}/comentarios/`, 'POST', { texto: text }),
    reply: (commentId: string, text: string) =>
      apiRequest<ApiComment>(`/comentarios/${encodeURIComponent(commentId)}/respostas/`, 'POST', {
        texto: text,
      }),
    update: (commentId: string, text: string) =>
      apiRequest<ApiComment>(`/comentarios/${encodeURIComponent(commentId)}/`, 'PATCH', { texto: text }),
    remove: (commentId: string) =>
      apiRequest<void>(`/comentarios/${encodeURIComponent(commentId)}/`, 'DELETE'),
    /** Comentários e respostas do usuário logado, do mais recente. */
    mine: (page = 1) => apiRequest<Paginated<ApiMyComment>>(listPath('/eu/comentarios/', {}, page)),
  },
}
