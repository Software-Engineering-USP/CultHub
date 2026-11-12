import type { CategoryId } from '@/types'

// A conta usa as APIs reais; os demais fluxos ainda são simulados abaixo.

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ProfileResponse {
  id: string
  nome: string
  email: string
  cidade: string
  bairro: string
  preferencias: CategoryId[]
  iniciais: string
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
  if (!response.ok) throw new ApiError(errorMessage(data), response.status)
  return data as T
}

// Mock: só registra a chamada. Devolve uma Promise para manter a mesma assinatura do fetch real.
function request(method: Method, path: string, body?: Record<string, unknown>): Promise<void> {
  const safeBody = body && 'senha' in body ? { ...body, senha: '***' } : body
  console.info(`[CultHub API mock] ${method} /api${path}`, safeBody ?? '')
  return Promise.resolve()
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

  /** Ainda demonstrativo: favoritos ainda não têm endpoint no backend. */
  events: {
    save: (eventId: string) => request('POST', `/eventos/${encodeURIComponent(eventId)}/salvar/`),
  },

  /** Provisório */
  comments: {
    create: (eventId: string, text: string) =>
      request('POST', `/eventos/${encodeURIComponent(eventId)}/comentarios/`, { texto: text }),
    reply: (commentId: string, text: string) =>
      request('POST', `/comentarios/${encodeURIComponent(commentId)}/respostas/`, { texto: text }),
    update: (commentId: string, text: string) =>
      request('PATCH', `/comentarios/${encodeURIComponent(commentId)}/`, { texto: text }),
    remove: (commentId: string) => request('DELETE', `/comentarios/${encodeURIComponent(commentId)}/`),
  },
}
