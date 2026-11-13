import type { ApiEvent, Paginated } from '@/services/catalog'

export function apiEvent(overrides: Partial<ApiEvent> = {}): ApiEvent {
  return {
    id: '6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1',
    titulo: 'Jazz no Parque',
    descricao: 'Show ao ar livre.',
    genero: 'Jazz',
    categorias: ['music'],
    data_inicio: '2040-03-10',
    hora_inicio: '20:00:00',
    inicio: '2040-03-10T20:00:00-03:00',
    fim: null,
    data_fim: null,
    hora_fim: null,
    fuso: 'America/Sao_Paulo',
    local: {
      nome: 'Parque Central',
      endereco: 'Rua A, 10',
      cidade: 'São Paulo',
      estado: 'SP',
      latitude: -23.5874,
      longitude: -46.6576,
    },
    situacao_preco: 'pago',
    faixas_preco: [{ minimo: 80, maximo: 120, moeda: 'BRL' }],
    imagens: [{ url: 'https://img.example/jazz.jpg', proporcao: '16_9', largura: 1200, altura: 675 }],
    avisos: '',
    situacao: 'onsale',
    removido: false,
    ...overrides,
  }
}

export function apiPage(results: ApiEvent[], next: string | null = null): Paginated<ApiEvent> {
  return { count: results.length, next, previous: null, results }
}
