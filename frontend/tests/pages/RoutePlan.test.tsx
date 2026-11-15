import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import { paths, routes } from '@/lib/paths'
import RoutePlan from '@/pages/RoutePlan'
import { ApiError, catalogApi } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaEvento } from '@/services/rotas'
import type { CalculatedRoute, Coordinates } from '@/types'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

// O Leaflet não desenha no jsdom; o mapa vira um resumo do que ele receberia.
vi.mock('@/components/map/RouteMap', () => ({
  default: ({
    origin,
    routes,
    selected,
  }: {
    origin?: Coordinates
    routes: CalculatedRoute[]
    selected: number
  }) => (
    <output aria-label="Mapa">
      {origin ? `partida ${origin.latitude},${origin.longitude}` : 'sem partida'} · {routes.length} rotas ·
      destacada {selected}
    </output>
  ),
}))

const id = 'sp-jazz-blues-festival'
const local = { latitude: -23.5874, longitude: -46.6576 }
const comPartida = '?latitude=-23.6&longitude=-46.7&rotulo=Rua+Augusta%2C+1500'

const rota = (metros: number, segundos: number): CalculatedRoute => ({
  distancia_metros: metros,
  duracao_segundos: segundos,
  geometria: { type: 'LineString', coordinates: [] },
})

function SearchProbe() {
  return <output aria-label="Query">{useLocation().search}</output>
}

function stubRoutes(
  respostas: Partial<Record<'carro' | 'a_pe', CalculatedRoute[] | Error>> = {
    carro: [rota(10_722, 1121), rota(11_500, 1300)],
    a_pe: [rota(10_800, 8700)],
  },
) {
  return vi.spyOn(rotasApi, 'rotaEvento').mockImplementation((_id, _ponto, modo) => {
    const resposta = respostas[modo] ?? []
    return resposta instanceof Error
      ? Promise.reject(resposta)
      : Promise.resolve<RotaEvento>({ modo, destino: local, rotas: resposta })
  })
}

function renderRoutePlan(search = '') {
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
        path={routes.eventRoute}
        element={
          <>
            <EventPage page={RoutePlan} notFoundMessage="Evento não encontrado." />
            <SearchProbe />
          </>
        }
      />
    </Routes>,
    { route: paths.eventRoute(id, search) },
  )
}

async function trajeto() {
  return within(await screen.findByRole('region', { name: 'Seu trajeto' }))
}

function comparacao(panel: ReturnType<typeof within>) {
  return within(panel.getByRole('list', { name: 'Comparação de transportes' }))
}

describe('RoutePlan', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sem partida, pede para escolher uma e não calcula rota', async () => {
    const spy = stubRoutes()
    renderRoutePlan()
    const panel = within(await screen.findByRole('region', { name: 'Defina sua partida' }))
    await waitFor(() => expect(document.title).toBe('Rota até Auditório Ibirapuera | CultHub'))
    expect(panel.getByRole('link', { name: /Escolher ponto de partida/ })).toHaveAttribute(
      'href',
      paths.eventOrigin(id),
    )
    expect(screen.getByLabelText('Mapa')).toHaveTextContent('sem partida')
    expect(spy).not.toHaveBeenCalled()
  })

  it('compara carro e a pé com os tempos reais e mostra o carro por padrão', async () => {
    const spy = stubRoutes()
    renderRoutePlan(comPartida)
    const panel = await trajeto()
    expect(panel.getByText('Rua Augusta, 1500')).toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Alterar' })).toHaveAttribute(
      'href',
      paths.eventOrigin(id, `${comPartida}&modo=carro`),
    )

    const modos = comparacao(panel)
    expect(await modos.findByText('19 min')).toBeInTheDocument()
    expect(await modos.findByText('2 h 25 min')).toBeInTheDocument()
    expect(modos.getByRole('button', { name: /Carro/ })).toHaveAttribute('aria-pressed', 'true')
    expect(modos.getByRole('button', { name: /Ônibus/ })).toBeDisabled()
    expect(modos.getByRole('button', { name: /Ônibus/ })).toHaveTextContent('Em breve')

    expect(panel.getByText('10,7 km • de carro • estimado sem trânsito')).toBeInTheDocument()
    expect(panel.getByText('Parta de Rua Augusta, 1500')).toBeInTheDocument()
    expect(panel.getByText('Chegue ao Auditório Ibirapuera')).toBeInTheDocument()
    expect(screen.getByLabelText('Mapa')).toHaveTextContent('partida -23.6,-46.7 · 2 rotas · destacada 0')

    const link = panel.getByRole('link', { name: /Abrir no OpenStreetMap/ })
    expect(link).toHaveAttribute('target', '_blank')
    const url = new URL(link.getAttribute('href') ?? '')
    expect(url.searchParams.get('engine')).toBe('fossgis_osrm_car')
    expect(url.searchParams.get('route')).toBe(`-23.6,-46.7;${local.latitude},${local.longitude}`)

    expect(spy).toHaveBeenCalledWith(
      id,
      { latitude: -23.6, longitude: -46.7 },
      'carro',
      expect.any(AbortSignal),
    )
    expect(spy).toHaveBeenCalledWith(
      id,
      { latitude: -23.6, longitude: -46.7 },
      'a_pe',
      expect.any(AbortSignal),
    )
  })

  it('troca o modo pela comparação e guarda ele na URL', async () => {
    stubRoutes()
    const { user } = renderRoutePlan(comPartida)
    const panel = await trajeto()
    await user.click(await comparacao(panel).findByRole('button', { name: /A pé/ }))

    expect(comparacao(panel).getByRole('button', { name: /A pé/ })).toHaveAttribute('aria-pressed', 'true')
    expect(new URLSearchParams(screen.getByLabelText('Query').textContent ?? '').get('modo')).toBe('ape')
    expect(panel.getByText('10,8 km • a pé')).toBeInTheDocument()
    expect(panel.queryByRole('group', { name: 'Opções de trajeto' })).not.toBeInTheDocument()
    const url = new URL(
      panel.getByRole('link', { name: /Abrir no OpenStreetMap/ }).getAttribute('href') ?? '',
    )
    expect(url.searchParams.get('engine')).toBe('fossgis_osrm_foot')
  })

  it('deixa escolher uma rota alternativa', async () => {
    stubRoutes()
    const { user } = renderRoutePlan(comPartida)
    const panel = await trajeto()
    const opcoes = within(await panel.findByRole('group', { name: 'Opções de trajeto' }))
    expect(opcoes.getByRole('radio', { name: /Opção 1 · recomendada/ })).toBeChecked()

    await user.click(opcoes.getByRole('radio', { name: /Opção 2/ }))
    expect(opcoes.getByRole('radio', { name: /Opção 2/ })).toBeChecked()
    expect(panel.getByText('22 min')).toBeInTheDocument()
    expect(screen.getByLabelText('Mapa')).toHaveTextContent('destacada 1')
  })

  it('avisa quando não há caminho a partir do ponto', async () => {
    stubRoutes({ carro: [], a_pe: [] })
    renderRoutePlan(comPartida)
    const panel = await trajeto()
    const alerta = await panel.findByRole('alert')
    expect(alerta).toHaveTextContent('Nenhum caminho encontrado')
    expect(alerta).toHaveTextContent('Mova o pino para perto de uma rua')
    expect(within(alerta).getByRole('link', { name: 'Alterar partida' })).toBeInTheDocument()
    expect(panel.queryByRole('link', { name: /Abrir no OpenStreetMap/ })).not.toBeInTheDocument()
    expect(comparacao(panel).getAllByText('Sem caminho')).toHaveLength(2)
  })

  it.each([
    [400, 'Escolha um ponto de partida a até 150 km do local do evento.'],
    [429, 'Muitas consultas seguidas. Aguarde um instante e tente de novo.'],
  ])('mostra o erro %i do modo escolhido sem esconder o outro', async (status, mensagem) => {
    stubRoutes({ carro: new ApiError(mensagem, status), a_pe: [rota(900, 700)] })
    renderRoutePlan(comPartida)
    const panel = await trajeto()
    const alerta = await panel.findByRole('alert')
    expect(alerta).toHaveTextContent('Não conseguimos calcular a rota')
    expect(alerta).toHaveTextContent(mensagem)
    const modos = comparacao(panel)
    expect(await modos.findByText('12 min')).toBeInTheDocument()
    expect(modos.getByText('Indisponível')).toBeInTheDocument()
  })

  it('mostra "Ponto marcado no mapa" quando a partida não tem endereço', async () => {
    stubRoutes()
    renderRoutePlan('?latitude=-23.6&longitude=-46.7&modo=onibus')
    const panel = await trajeto()
    expect(panel.getByText('Ponto marcado no mapa')).toBeInTheDocument()
    // Ônibus ainda não existe: cai no carro.
    expect(comparacao(panel).getByRole('button', { name: /Carro/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
