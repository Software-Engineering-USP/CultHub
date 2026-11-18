import type { ApiComment, ApiMyComment } from '@/services/api'
import type { Paginated } from '@/services/catalog'

export function apiComment(overrides: Partial<ApiComment> = {}): ApiComment {
  return {
    id: 'c1',
    evento: 'sp-jazz-blues-festival',
    resposta_a: null,
    nivel: 0,
    autor: { id: 'rafael-martins', nome: 'Rafael Martins', iniciais: 'RM' },
    texto: 'Gostei da proposta!',
    criado_em: '2026-11-15T20:00:00Z',
    editado_em: null,
    removido: false,
    meu: false,
    respostas: [],
    ...overrides,
  }
}

export function apiMyComment(overrides: Partial<ApiMyComment> = {}): ApiMyComment {
  return {
    id: 'm1',
    evento: { id: 'sp-jazz-blues-festival', titulo: 'São Paulo Jazz & Blues Festival' },
    resposta_a: null,
    nivel: 0,
    texto: 'Jazz ao vivo no Ibirapuera!',
    criado_em: '2026-11-15T20:00:00Z',
    editado_em: null,
    ...overrides,
  }
}

export function commentPage<T>(
  results: T[],
  next: string | null = null,
  count = results.length,
): Paginated<T> {
  return { count, next, previous: null, results }
}
