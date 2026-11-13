import { act, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import { paths, routes } from '@/lib/paths'
import Origin from '@/pages/Origin'
import { ApiError, catalogApi } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { Coordinates } from '@/types'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

// O Leaflet não desenha no jsdom; o mapa é trocado por um botão que "marca" um ponto.
vi.mock('@/components/map/OriginMap', () => ({
  default: ({
    origin,
    onOriginChange,
  }: {
    origin: Coordinates | null
    onOriginChange: (point: Coordinates) => void
  }) => (
    <div>
      <span data-testid="pino">{origin ? `${origin.latitude},${origin.longitude}` : 'sem pino'}</span>
      <button type="button" onClick={() => onOriginChange({ latitude: -23.6, longitude: -46.7 })}>
        Marcar ponto no mapa
      </button>
    </div>
  ),
}))

const id = 'sp-jazz-blues-festival'
const local = { latitude: -23.5874, longitude: -46.6576 }
const augusta = {
  rotulo: 'Rua Augusta, 1500, Consolação, São Paulo',
  latitude: -23.5565,
  longitude: -46.6586,
}

function RouteDestination() {
  const location = useLocation()
  return (
    <>
      <h1>Página da rota</h1>
      <output aria-label="Query da rota">{location.search}</output>
    </>
  )
}

function renderOrigin(route = paths.eventOrigin(id)) {
  vi.spyOn(catalogApi, 'event').mockResolvedValue(
    apiEvent({
      id,
      titulo: 'Jazz no Parque',
      local: { nome: 'Auditório Ibirapuera', endereco: '', cidade: 'São Paulo', estado: 'SP', ...local },
    }),
  )
  return renderWithRouter(
    <Routes>
      <Route
        path={routes.eventOrigin}
        element={<EventPage page={Origin} notFoundMessage="Evento não encontrado." />}
      />
      <Route path={routes.eventRoute} element={<RouteDestination />} />
    </Routes>,
    { route },
  )
}

function stubGeolocation(getCurrentPosition: Geolocation['getCurrentPosition']) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  })
}

function routeQuery() {
  return new URLSearchParams(screen.getByLabelText('Query da rota').textContent ?? '')
}

describe('Origin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('mostra o caminho até "Como chegar", o destino e o mapa', async () => {
    renderOrigin()
    expect(await screen.findByRole('heading', { level: 1, name: 'Como chegar' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Defina sua origem | CultHub'))
    expect(screen.getByRole('link', { name: 'Voltar para o evento' })).toHaveAttribute(
      'href',
      paths.event(id),
    )
    const panel = screen.getByRole('region', { name: 'De onde você vai sair?' })
    expect(panel).toHaveTextContent('Auditório Ibirapuera')
    expect(panel).toHaveTextContent('Ainda não definida')
    expect(panel).toHaveTextContent('© OpenStreetMap contributors')
    expect(screen.getByLabelText('Carro')).toBeChecked()
    expect(screen.getByTestId('pino')).toHaveTextContent('sem pino')
  })

  it('mostra o aviso quando a API responde que o evento não existe', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new ApiError('Não encontrado. (404)', 404))
    renderWithRouter(
      <Routes>
        <Route
          path={routes.eventOrigin}
          element={<EventPage page={Origin} notFoundMessage="Evento não encontrado." />}
        />
      </Routes>,
      { route: paths.eventOrigin('nao-existe') },
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
  })

  it('sugere endereços perto do evento e leva a escolhida para a rota', async () => {
    const busca = vi.spyOn(rotasApi, 'buscarOrigem').mockResolvedValue([augusta])
    const { user } = renderOrigin()

    const campo = await screen.findByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'rua augusta')
    const opcao = await screen.findByRole('option', { name: augusta.rotulo })
    expect(busca).toHaveBeenCalledTimes(1)
    expect(busca).toHaveBeenCalledWith('rua augusta', local, expect.any(AbortSignal))

    await user.click(opcao)
    expect(campo).toHaveValue(augusta.rotulo)
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByTestId('pino')).toHaveTextContent('-23.5565,-46.6586')

    await user.click(screen.getByLabelText('A pé'))
    await user.click(screen.getByRole('button', { name: 'Traçar rota' }))

    expect(await screen.findByRole('heading', { name: 'Página da rota' })).toBeInTheDocument()
    const query = routeQuery()
    expect(Object.fromEntries(query)).toEqual({
      latitude: '-23.5565',
      longitude: '-46.6586',
      rotulo: augusta.rotulo,
      modo: 'ape',
    })
  })

  it('escolhe a sugestão pelo teclado', async () => {
    vi.spyOn(rotasApi, 'buscarOrigem').mockResolvedValue([augusta])
    const { user } = renderOrigin()
    const campo = await screen.findByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'augusta')
    await screen.findByRole('option', { name: augusta.rotulo })
    await user.keyboard('{ArrowDown}{Enter}')
    expect(campo).toHaveValue(augusta.rotulo)
  })

  it('↑ sem nada selecionado vai para a última sugestão', async () => {
    const paulista = { rotulo: 'Av. Paulista, 1000', latitude: -23.56, longitude: -46.65 }
    vi.spyOn(rotasApi, 'buscarOrigem').mockResolvedValue([augusta, paulista])
    const { user } = renderOrigin()
    const campo = await screen.findByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'sao paulo')
    await screen.findByRole('option', { name: paulista.rotulo })
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { name: paulista.rotulo })).toHaveAttribute('aria-selected', 'true')
  })

  it('editar o endereço depois de escolher desfaz a partida', async () => {
    vi.spyOn(rotasApi, 'buscarOrigem').mockResolvedValue([augusta])
    const { user } = renderOrigin()
    const campo = await screen.findByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'augusta')
    await user.click(await screen.findByRole('option', { name: augusta.rotulo }))

    await user.clear(campo)
    await user.type(campo, 'Rua Outra 500{Escape}{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma das sugestões de endereço')
    expect(screen.getByTestId('pino')).toHaveTextContent('sem pino')
    expect(screen.queryByRole('heading', { name: 'Página da rota' })).not.toBeInTheDocument()
  })

  it('ignora a localização que chega depois de a pessoa escolher um endereço', async () => {
    let entregar: (() => void) | undefined
    stubGeolocation((success) => {
      entregar = () => success({ coords: { latitude: -23.58, longitude: -46.65 } } as GeolocationPosition)
    })
    const reversa = vi.spyOn(rotasApi, 'reversa')
    vi.spyOn(rotasApi, 'buscarOrigem').mockResolvedValue([augusta])
    const { user } = renderOrigin()

    await user.click(await screen.findByRole('button', { name: 'Usar minha localização' }))
    const campo = screen.getByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'augusta')
    await user.click(await screen.findByRole('option', { name: augusta.rotulo }))

    act(() => entregar?.())
    expect(reversa).not.toHaveBeenCalled()
    expect(campo).toHaveValue(augusta.rotulo)
    expect(screen.getByTestId('pino')).toHaveTextContent('-23.5565,-46.6586')
    expect(screen.getByRole('button', { name: 'Usar minha localização' })).toBeEnabled()
  })

  it('não troca o texto digitado pelo endereço do ponto que chega depois', async () => {
    let responder: ((rotulo: string) => void) | undefined
    vi.spyOn(rotasApi, 'reversa').mockImplementation(
      () => new Promise<string | null>((resolve) => (responder = resolve)),
    )
    vi.spyOn(rotasApi, 'buscarOrigem').mockResolvedValue([])
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Marcar ponto no mapa' }))
    const campo = screen.getByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'rua')

    await act(async () => responder?.('Rua X, Moema'))
    expect(campo).toHaveValue('rua')
  })

  it('mostra mensagem em português quando a busca falha sem ser erro da API', async () => {
    vi.spyOn(rotasApi, 'buscarOrigem').mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = renderOrigin()
    const campo = await screen.findByRole('combobox', { name: 'Endereço de partida' })
    await user.type(campo, 'augusta')
    expect(await screen.findByText('Não foi possível buscar o endereço.')).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
  })

  it('não busca com menos de 3 letras e avisa quando o serviço de endereços falha', async () => {
    const busca = vi
      .spyOn(rotasApi, 'buscarOrigem')
      .mockRejectedValue(new ApiError('O serviço de endereços está indisponível agora.', 502))
    const { user } = renderOrigin()
    const campo = await screen.findByRole('combobox', { name: 'Endereço de partida' })

    await user.type(campo, 'ru')
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(busca).not.toHaveBeenCalled()

    await user.type(campo, 'a')
    expect(await screen.findByText('O serviço de endereços está indisponível agora.')).toBeInTheDocument()
  })

  it('"Usar minha localização" põe o pino e mostra o endereço do ponto', async () => {
    stubGeolocation((success) =>
      success({ coords: { latitude: -23.58, longitude: -46.65 } } as GeolocationPosition),
    )
    const reversa = vi.spyOn(rotasApi, 'reversa').mockResolvedValue('Rua Antônio de Queiroga, Moema')
    const { user } = renderOrigin()

    await user.click(await screen.findByRole('button', { name: 'Usar minha localização' }))

    expect(reversa).toHaveBeenCalledWith({ latitude: -23.58, longitude: -46.65 }, expect.any(AbortSignal))
    const panel = within(screen.getByRole('region', { name: 'De onde você vai sair?' }))
    expect(await panel.findByText('Rua Antônio de Queiroga, Moema')).toBeInTheDocument()
    expect(screen.getByTestId('pino')).toHaveTextContent('-23.58,-46.65')
    expect(screen.getByRole('combobox', { name: 'Endereço de partida' })).toHaveValue(
      'Rua Antônio de Queiroga, Moema',
    )
  })

  it('avisa quando a pessoa não permite a localização', async () => {
    stubGeolocation((_success, error) => error?.({ code: 1 } as GeolocationPositionError))
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Usar minha localização' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Você não permitiu o uso da localização')
  })

  it('avisa quando o navegador não tem geolocalização', async () => {
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Usar minha localização' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos obter sua localização')
  })

  it('o ponto marcado no mapa vale mesmo sem endereço', async () => {
    vi.spyOn(rotasApi, 'reversa').mockResolvedValue(null)
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Marcar ponto no mapa' }))
    expect(await screen.findByText('Ponto marcado no mapa')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Traçar rota' }))
    await screen.findByRole('heading', { name: 'Página da rota' })
    expect(Object.fromEntries(routeQuery())).toEqual({ latitude: '-23.6', longitude: '-46.7', modo: 'carro' })
  })

  it('avisa quando não acha o endereço do ponto, mas mantém o pino', async () => {
    vi.spyOn(rotasApi, 'reversa').mockRejectedValue(new ApiError('Muitas consultas seguidas.', 429))
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Marcar ponto no mapa' }))
    expect(
      await screen.findByText('Muitas consultas seguidas. O ponto marcado ainda pode ser usado.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('pino')).toHaveTextContent('-23.6,-46.7')
  })

  it('não traça a rota sem partida definida', async () => {
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Traçar rota' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma das sugestões de endereço')
    expect(screen.getByRole('combobox', { name: 'Endereço de partida' })).toHaveFocus()
    expect(screen.queryByRole('heading', { name: 'Página da rota' })).not.toBeInTheDocument()
  })

  it('volta da rota com a partida e o transporte já escolhidos', async () => {
    renderOrigin(`${paths.eventOrigin(id)}?latitude=-23.6&longitude=-46.7&rotulo=Rua+X&modo=ape`)
    expect(await screen.findByRole('combobox', { name: 'Endereço de partida' })).toHaveValue('Rua X')
    expect(screen.getByLabelText('A pé')).toBeChecked()
    expect(screen.getByTestId('pino')).toHaveTextContent('-23.6,-46.7')
  })
})
