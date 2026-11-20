import { fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoryOrder } from '@/lib/categories'
import { paths, routes } from '@/lib/paths'
import Home from '@/pages/Home'
import { catalogApi } from '@/services/catalog'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'
import { fakePermission, pendingGps, restoreGeolocation, stubGeolocation } from '@tests/geolocation'
import { renderWithRouter } from '@tests/render'

describe('Home', () => {
  afterEach(() => {
    restoreGeolocation()
    vi.restoreAllMocks()
  })

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
    expect(await screen.findByRole('region', { name: 'Mapa dos eventos' })).toHaveTextContent(
      'OpenStreetMap contributors',
    )
    expect(
      within(screen.getByRole('list', { name: 'Legenda de categorias' })).getAllByRole('listitem'),
    ).toHaveLength(categoryOrder.length)
    expect(await screen.findByRole('region', { name: '1 próximos eventos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos eventos' })).toBeInTheDocument()
  })

  it('serializa os filtros da URL no contrato do backend', async () => {
    const events = vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    renderWithRouter(<Home />, {
      route:
        '/?q=jazz&categorias=music,art&preco=gratuito&de=2026-12-01&ate=2026-12-31&lat=-23.55&lng=-46.63&raio=5',
    })

    await screen.findByText('Nenhum evento encontrado com esses filtros.')
    expect(events).toHaveBeenCalledWith(
      {
        q: 'jazz',
        categorias: ['music', 'art'],
        preco: 'gratuito',
        de: '2026-12-01',
        ate: '2026-12-31',
        tamanho: 200,
        lat: -23.55,
        lng: -46.63,
        raio: 5,
        page: 1,
      },
      expect.any(AbortSignal),
    )
  })

  it('não restringe o catálogo quando todas as categorias estão na URL', async () => {
    const events = vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    renderWithRouter(<Home />, { route: '/?categorias=music,festival,theater,sport,art' })

    await screen.findByText('Nenhum evento encontrado com esses filtros.')
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({ categorias: undefined, tamanho: 200 }),
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

  it('mostra no mapa os pinos dos eventos com local e abre o evento ao clicar', async () => {
    const local = { nome: 'Parque', endereco: '', cidade: 'São Paulo', estado: 'SP' }
    vi.spyOn(catalogApi, 'events').mockResolvedValue(
      apiPage([
        apiEvent({
          id: 'com-local',
          titulo: 'Show no parque',
          local: { ...local, latitude: -23.58, longitude: -46.65 },
        }),
        apiEvent({ id: 'sem-local', titulo: 'Show sem local', local }),
      ]),
    )
    renderWithRouter(
      <Routes>
        <Route path={routes.home} element={<Home />} />
        <Route path={routes.event} element={<p>Página do evento</p>} />
      </Routes>,
    )

    const map = await screen.findByRole('region', { name: 'Mapa dos eventos' })
    expect(await within(map).findByRole('img', { name: 'Show no parque' })).toBeInTheDocument()
    expect(within(map).queryByRole('img', { name: 'Show sem local' })).not.toBeInTheDocument()
    expect(screen.getByText('1 evento da lista abaixo está no mapa.')).toBeInTheDocument()

    // No jsdom o Leaflet não calcula a posição de um clique; o Enter no pino (keypress) dispara o mesmo evento.
    const pinIcon = within(map).getByRole('img', { name: 'Show no parque' }).closest('.leaflet-marker-icon')
    fireEvent.keyPress(pinIcon!, { key: 'Enter', keyCode: 13, charCode: 13 })
    expect(await screen.findByText('Página do evento')).toBeInTheDocument()
  })

  it('"Minha Localização" pede a posição e marca a pessoa no mapa', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: -23.6, longitude: -46.7 } } as GeolocationPosition),
    )
    stubGeolocation(fakePermission('prompt'), getCurrentPosition)
    const { user } = renderWithRouter(<Home />)

    expect(screen.queryByRole('img', { name: 'Você está aqui' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Minha Localização/ }))
    expect(await screen.findByRole('img', { name: 'Você está aqui' })).toBeInTheDocument()
    expect(getCurrentPosition).toHaveBeenCalledOnce()
  })

  it('o botão continua com o foco enquanto busca e aponta para o aviso', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    const gps = pendingGps()
    stubGeolocation(fakePermission('prompt'), gps.getCurrentPosition)
    const { user } = renderWithRouter(<Home />)
    const button = screen.getByRole('button', { name: /Minha Localização/ })

    await user.click(button)

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(button).toHaveFocus()
    expect(button).toHaveAccessibleDescription('Obtendo sua localização…')
    // Um segundo clique durante a busca não pede de novo.
    await user.click(button)
    expect(gps.getCurrentPosition).toHaveBeenCalledOnce()
  })

  it('avisa quando a pessoa não permite a localização', async () => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([]))
    stubGeolocation(fakePermission('prompt'), (_: PositionCallback, failure: PositionErrorCallback) =>
      failure({ code: 1 } as GeolocationPositionError),
    )
    const { user } = renderWithRouter(<Home />)

    await user.click(screen.getByRole('button', { name: /Minha Localização/ }))
    expect(await screen.findByText(/Você não permitiu o uso da localização/)).toBeInTheDocument()
  })
})
