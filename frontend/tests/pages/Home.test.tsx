import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoryOrder } from '@/lib/categories'
import * as demo from '@/lib/demo'
import { paths } from '@/lib/paths'
import Home from '@/pages/Home'
import { catalogApi } from '@/services/catalog'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

describe('Home', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renderiza estados e lista o catálogo retornado pela API', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(
      apiPage([apiEvent(), apiEvent({ id: 'event-2', titulo: 'Teatro da Cidade', categorias: ['theater'] })]),
    )
    renderWithRouter(<Home />)

    expect(await screen.findAllByRole('heading', { level: 3, name: 'Jazz no Parque' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { level: 3, name: 'Teatro da Cidade' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Conhecer Jazz no Parque' })[0]).toHaveAttribute(
      'href',
      paths.event('6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1'),
    )
    expect(screen.getByText('Exibindo 2 de 2 evento(s)')).toBeInTheDocument()
    expect(document.title).toBe('CultHub | Explore São Paulo')
  })

  it('mantém o mapa e a legenda de categorias', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([apiEvent()]))
    renderWithRouter(<Home />)

    expect(screen.getByRole('heading', { level: 1, name: 'Mapa de Eventos' })).toBeInTheDocument()
    expect(screen.getByRole('figure')).toHaveTextContent('OpenStreetMap contributors')
    expect(
      within(screen.getByRole('list', { name: 'Legenda de categorias' })).getAllByRole('listitem'),
    ).toHaveLength(categoryOrder.length)
    expect(await screen.findByRole('region', { name: '1 próximos eventos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
  })

  it('serializa os filtros da URL no contrato do backend', async () => {
    const events = vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    renderWithRouter(<Home />, { route: '/?q=jazz&categorias=music,art&preco=gratuito' })

    await screen.findByText('Nenhum evento encontrado com esses filtros.')
    expect(events).toHaveBeenCalledWith(
      { q: 'jazz', categorias: ['music', 'art'], preco: 'gratuito', page: 1 },
      expect.any(AbortSignal),
    )
  })

  it('mostra estado vazio quando a busca não retorna eventos', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    renderWithRouter(<Home />)
    expect(await screen.findByText('Nenhum evento encontrado com esses filtros.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /próximos eventos/ })).not.toBeInTheDocument()
  })

  it('mostra falhas da API e permite tentar carregar uma página seguinte', async () => {
    vi.spyOn(catalogApi, 'events')
      .mockResolvedValueOnce(apiPage([apiEvent()], '/api/eventos/?page=2'))
      .mockResolvedValueOnce(apiPage([apiEvent({ id: 'event-2', titulo: 'Segundo evento' })]))
    const { user } = renderWithRouter(<Home />)
    expect(await screen.findAllByRole('heading', { level: 3, name: 'Jazz no Parque' })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Carregar mais eventos' }))
    expect(await screen.findAllByRole('heading', { level: 3, name: 'Segundo evento' })).toHaveLength(2)
  })

  it('expõe erro de rede e informa erro acessivelmente', async () => {
    vi.spyOn(catalogApi, 'events').mockRejectedValue(new Error('Backend indisponível (503)'))
    renderWithRouter(<Home />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend indisponível (503)')
  })

  it('"Minha Localização" continua claramente demonstrativa', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderWithRouter(<Home />)
    await user.click(screen.getByRole('button', { name: /Minha Localização/ }))
    expect(log).toHaveBeenCalledWith('Pedir localização do usuário')
  })
})
