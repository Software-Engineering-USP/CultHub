import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogApi, toCultEvent } from '@/services/catalog'
import { apiEvent } from '@tests/fixtures/catalog'

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('catalogApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('consulta categorias com cookies de sessão', async () => {
    const fetch = vi.fn().mockResolvedValue(response([{ codigo: 'music', nome: 'Música' }]))
    vi.stubGlobal('fetch', fetch)

    await expect(catalogApi.categories()).resolves.toEqual([{ codigo: 'music', nome: 'Música' }])
    expect(fetch).toHaveBeenCalledWith('/api/categorias/', { credentials: 'include', signal: undefined })
  })

  it('codifica busca e filtros na querystring do contrato do backend', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ count: 0, next: null, previous: null, results: [] }))
    vi.stubGlobal('fetch', fetch)

    await catalogApi.events({ q: 'jazz & blues', categorias: ['music', 'art'], preco: 'gratuito', page: 2 })
    expect(fetch).toHaveBeenCalledWith(
      '/api/eventos/?q=jazz+%26+blues&categorias=music%2Cart&preco=gratuito&page=2',
      { credentials: 'include', signal: undefined },
    )
  })

  it('omite filtros vazios e a primeira página', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ count: 0, next: null, previous: null, results: [] }))
    vi.stubGlobal('fetch', fetch)

    await catalogApi.events({ q: '   ', categorias: [], page: 1 })
    expect(fetch).toHaveBeenCalledWith('/api/eventos/', { credentials: 'include', signal: undefined })
  })

  it('codifica o identificador do detalhe e encaminha o AbortSignal', async () => {
    const fetch = vi.fn().mockResolvedValue(response(apiEvent()))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()

    await catalogApi.event('abc/def', controller.signal)
    expect(fetch).toHaveBeenCalledWith('/api/eventos/abc%2Fdef/', {
      credentials: 'include',
      signal: controller.signal,
    })
  })

  it('transforma erros de validação do backend em mensagem com status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ categorias: ['Categoria inexistente: xyz.'] }, 400)),
    )

    await expect(catalogApi.events({ categorias: ['music'] })).rejects.toThrow(
      'Categoria inexistente: xyz. (400)',
    )
    await expect(catalogApi.events({ categorias: ['music'] })).rejects.toMatchObject({ status: 400 })
  })

  it('usa mensagem HTTP se o corpo de erro não for JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockRejectedValue(new SyntaxError('JSON inválido')),
      }),
    )

    await expect(catalogApi.categories()).rejects.toThrow('Falha ao carregar o catálogo. (503)')
  })

  it('propaga falhas de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(catalogApi.categories()).rejects.toThrow('Failed to fetch')
  })
})

describe('toCultEvent', () => {
  it('mapeia os campos do backend para o tipo usado pelos cards e detalhes', () => {
    const event = toCultEvent(apiEvent())

    expect(event).toMatchObject({
      id: '6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1',
      title: 'Jazz no Parque',
      category: 'music',
      description: 'Show ao ar livre.',
      venue: 'Parque Central',
      location: { latitude: -23.5874, longitude: -46.6576 },
      priceValue: 80,
      image: 'https://img.example/jazz.jpg',
      details: { about: ['Show ao ar livre.'], startTime: '20:00' },
    })
    expect(event.price.replaceAll('\u00a0', ' ')).toBe('A partir de R$ 80,00')
    expect(event.schedule).toContain('10 de março')
  })

  it('não inventa coordenadas quando o local não as tem', () => {
    const local = { nome: 'Sem mapa', endereco: '', cidade: 'São Paulo', estado: 'SP' }
    expect(toCultEvent(apiEvent({ local })).location).toBeUndefined()
    expect(
      toCultEvent(apiEvent({ local: { ...local, latitude: null, longitude: null } })).location,
    ).toBeUndefined()
  })

  it('junta endereço, cidade e estado do local, sem partes vazias', () => {
    const local = {
      nome: 'Qualistage',
      endereco: 'Av. Ayrton Senna, 3000',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
    }
    expect(toCultEvent(apiEvent({ local })).venueAddress).toBe('Av. Ayrton Senna, 3000, Rio de Janeiro, RJ')
    expect(toCultEvent(apiEvent({ local: { ...local, endereco: '' } })).venueAddress).toBe(
      'Rio de Janeiro, RJ',
    )
    expect(toCultEvent(apiEvent({ local: null })).venueAddress).toBeUndefined()
  })

  it('representa evento gratuito sem depender das faixas de preço', () => {
    const event = toCultEvent(apiEvent({ situacao_preco: 'gratuito', faixas_preco: [] }))
    expect(event.price).toBe('Gratuito')
    expect(event.priceValue).toBe(0)
  })

  it('não confunde preço desconhecido com evento gratuito', () => {
    const event = toCultEvent(apiEvent({ situacao_preco: 'desconhecido', faixas_preco: [] }))
    expect(event.price).toBe('Preço não informado')
    expect(event.priceValue).toBe(0)
  })

  it.each([
    [{ removido: true }, 'removed'],
    [{ situacao: 'cancelled' }, 'cancelled'],
    [{ data_inicio: '2020-01-01' }, 'ended'],
  ] as const)('preserva a indisponibilidade %s do evento', (overrides, expected) => {
    expect(toCultEvent(apiEvent(overrides)).availability).toBe(expected)
  })

  it('usa dados seguros quando local, imagem, categoria, horário ou descrição faltam', () => {
    const event = toCultEvent(
      apiEvent({
        descricao: '',
        categorias: [],
        data_inicio: '2040-03-10',
        hora_inicio: null,
        local: null,
        imagens: [],
      }),
    )
    expect(event.location).toBeUndefined()
    expect(event).toMatchObject({
      category: 'art',
      description: 'Mais informações sobre este evento em breve.',
      venue: 'Local a confirmar',
      image: '/assets/event-placeholder.svg',
      schedule: expect.stringContaining('10 de março'),
      details: { startTime: 'Horário a confirmar' },
    })
  })
})
