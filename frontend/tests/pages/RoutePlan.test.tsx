import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import { paths, routes } from '@/lib/paths'
import RoutePlan from '@/pages/RoutePlan'
import { ApiError, catalogApi } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaCalculada } from '@/services/rotas'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

const id = 'sp-jazz-blues-festival'
const partida = '?latitude=-23.6&longitude=-46.7&rotulo=Rua+Augusta%2C+1500'

const rota = (duracao: number, distancia: number): RotaCalculada => ({
  duracao_segundos: duracao,
  distancia_metros: distancia,
  geometria: {
    type: 'LineString',
    coordinates: [
      [-46.7, -23.6],
      [-46.65, -23.58],
    ],
  },
})

function renderRoutePlan(search = partida) {
  vi.spyOn(catalogApi, 'event').mockResolvedValue(
    apiEvent({
      id,
      titulo: 'Jazz no Parque',
      local: {
        nome: 'Auditório Ibirapuera',
        endereco: '',
        cidade: 'São Paulo',
        estado: 'SP',
        latitude: -23.5874,
        longitude: -46.6576,
      },
    }),
  )
  return renderWithRouter(
    <Routes>
      <Route
        path={routes.eventRoute}
        element={<EventPage page={RoutePlan} notFoundMessage="Evento não encontrado." />}
      />
      <Route path={routes.eventOrigin} element={<p>Página de origem</p>} />
    </Routes>,
    { route: paths.eventRoute(id, search) },
  )
}

type Resposta = () => Promise<RotaCalculada[]>

function mockRoutes(carro: Resposta, aPe: Resposta) {
  return vi
    .spyOn(rotasApi, 'rota')
    .mockImplementation((_evento, _partida, modo) => (modo === 'carro' ? carro() : aPe()))
}

describe('RoutePlan', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calcula carro e a pé, destaca o modo escolhido e mostra o resumo', async () => {
    const rotaSpy = mockRoutes(
      () => Promise.resolve([rota(720, 6400)]),
      () => Promise.resolve([rota(2040, 2800)]),
    )
    renderRoutePlan()

    const panel = within(await screen.findByRole('region', { name: 'Seu trajeto' }))
    await waitFor(() => expect(document.title).toBe('Rota até o evento | CultHub'))
    expect(await panel.findByText('6,4 km • de carro')).toBeInTheDocument()
    expect(panel.getByText('Sem trânsito em tempo real')).toBeInTheDocument()
    expect(panel.getByText('Rua Augusta, 1500')).toBeInTheDocument()

    const modes = within(panel.getByRole('navigation', { name: 'Formas de chegar' }))
    expect(modes.getByRole('link', { name: /Carro/ })).toHaveAttribute('aria-current', 'true')
    expect(modes.getByRole('link', { name: /A pé/ })).toHaveTextContent('34 min')
    expect(modes.getByRole('link', { name: /Ônibus/ })).toHaveTextContent('no Google Maps')

    const point = { latitude: -23.6, longitude: -46.7 }
    expect(rotaSpy).toHaveBeenCalledWith(id, point, 'carro', expect.any(AbortSignal))
    expect(rotaSpy).toHaveBeenCalledWith(id, point, 'a_pe', expect.any(AbortSignal))
    expect(screen.getByRole('region', { name: 'Mapa do trajeto até o evento' })).toHaveTextContent(
      'Corrigir o mapa',
    )
  })

  it('troca de modo pelos cartões sem calcular de novo', async () => {
    const rotaSpy = mockRoutes(
      () => Promise.resolve([rota(720, 6400)]),
      () => Promise.resolve([rota(2040, 2800)]),
    )
    const { user } = renderRoutePlan()
    const panel = within(await screen.findByRole('region', { name: 'Seu trajeto' }))

    await user.click(await panel.findByRole('link', { name: /A pé/ }))
    expect(await panel.findByText('2,8 km • a pé')).toBeInTheDocument()
    expect(panel.queryByText('Sem trânsito em tempo real')).not.toBeInTheDocument()
    expect(rotaSpy).toHaveBeenCalledTimes(2)
  })

  it('no ônibus, leva ao Google Maps com transporte público', async () => {
    mockRoutes(
      () => Promise.resolve([rota(720, 6400)]),
      () => Promise.resolve([rota(2040, 2800)]),
    )
    renderRoutePlan(`${partida}&modo=onibus`)

    const link = await screen.findByRole('link', { name: /Ver ônibus no Google Maps/ })
    const url = new URL(link.getAttribute('href') ?? '')
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/')
    expect(url.searchParams.get('origin')).toBe('-23.6,-46.7')
    expect(url.searchParams.get('destination')).toBe('Auditório Ibirapuera, São Paulo, SP')
    expect(url.searchParams.get('travelmode')).toBe('transit')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText(/ainda não calcula trajetos de ônibus/)).toBeInTheDocument()
  })

  it('avisa quando não há trajeto e mostra a mensagem do backend em caso de erro', async () => {
    mockRoutes(
      () => Promise.resolve([]),
      () => Promise.reject(new ApiError('Escolha um ponto de partida a até 30 km do local do evento.', 400)),
    )
    const { user } = renderRoutePlan()
    const panel = within(await screen.findByRole('region', { name: 'Seu trajeto' }))

    expect(await panel.findByText(/Não encontramos um trajeto a partir desse ponto/)).toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Mude a partida' })).toHaveAttribute(
      'href',
      paths.eventOrigin(id, `${partida}&modo=carro`),
    )

    await user.click(panel.getByRole('link', { name: /A pé/ }))
    expect(await panel.findByText(/a até 30 km do local do evento/)).toBeInTheDocument()
  })

  it('sem partida, manda para a página de origem', async () => {
    renderRoutePlan('')
    expect(await screen.findByText('Página de origem')).toBeInTheDocument()
  })

  it('mostra "Ponto marcado no mapa" quando a partida não tem endereço', async () => {
    mockRoutes(
      () => new Promise(() => {}),
      () => new Promise(() => {}),
    )
    renderRoutePlan('?latitude=-23.6&longitude=-46.7')
    const panel = within(await screen.findByRole('region', { name: 'Seu trajeto' }))
    expect(panel.getByText('Ponto marcado no mapa')).toBeInTheDocument()
    expect(panel.getByText('Calculando a rota…')).toBeInTheDocument()
  })
})
