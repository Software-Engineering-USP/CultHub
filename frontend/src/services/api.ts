import type { CategoryId, RouteOption } from '@/types'

// Endpoints marcados como "provisório" ainda não existem no backend.

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function request(method: Method, path: string, body?: Record<string, unknown>): Promise<void> {
  const safeBody = body && 'senha' in body ? { ...body, senha: '***' } : body
  console.info(`[CultHub API mock] ${method} /api${path}`, safeBody ?? '')
}

export const api = {
  auth: {
    signUp: (data: { name: string; email: string; password: string; acceptedTerms: boolean }) =>
      request('POST', '/auth/cadastro/', {
        nome: data.name,
        email: data.email,
        senha: data.password,
        aceite_termos: data.acceptedTerms,
      }),
    signIn: (data: { email: string; password: string; remember: boolean }) =>
      request('POST', '/auth/entrar/', { email: data.email, senha: data.password, lembrar: data.remember }),
    signOut: () => request('POST', '/auth/sair/'),
    /** Provisório */
    forgotPassword: (email: string) => request('POST', '/auth/recuperar-senha/', { email }),
  },

  profile: {
    /** O e-mail não é editável no backend, então não é enviado. */
    update: (data: { name: string; city: string; district: string }) =>
      request('PATCH', '/eu/', { nome: data.name, cidade: data.city, bairro: data.district }),
    updatePreferences: (categories: CategoryId[]) => request('PATCH', '/eu/', { preferencias: categories }),
  },

  /** Provisório */
  events: {
    search: (query: string) => request('GET', `/eventos/?busca=${encodeURIComponent(query)}`),
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

  /** Provisório */
  routes: {
    plan: (data: { eventId: string; origin: string; mode: RouteOption['id'] }) =>
      request('POST', '/rotas/', { evento_id: data.eventId, origem: data.origin, transporte: data.mode }),
  },
}
