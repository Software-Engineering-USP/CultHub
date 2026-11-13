import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RoutePreview from '@/components/events/RoutePreview'
import { originSearch } from '@/lib/origin'
import { paths } from '@/lib/paths'
import { toCultEvent } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import type { RotaCalculada } from '@/services/rotas'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

const rota = (duracao: number, distancia: number): RotaCalculada => ({
  duracao_segundos: duracao,
  distancia_metros: distancia,
  geometria: { type: 'LineString', coordinates: [] },
})

const local = { nome: 'Auditório Ibirapuera', endereco: '', cidade: 'São Paulo', estado: 'SP' }
const emSaoPaulo = toCultEvent(apiEvent({ local: { ...local, latitude: -23.5874, longitude: -46.6576 } }))

function stubPermission(state: PermissionState, position?: { latitude: number; longitude: number }) {
  vi.stubGlobal('navigator', {
    ...navigator,
    permissions: { query: vi.fn().mockResolvedValue({ state }) },
    geolocation: {
      getCurrentPosition: vi.fn(
        (success: PositionCallback) => position && success({ coords: position } as GeolocationPosition),
      ),
    },
  })
}

describe('RoutePreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sem permissão de localização, estima a partir do centro de SP', async () => {
    stubPermission('prompt')
    const spy = vi
      .spyOn(rotasApi, 'rota')
      .mockImplementation(async (_e, _p, modo) => (modo === 'carro' ? [rota(720, 6400)] : [rota(2040, 2800)]))
    renderWithRouter(<RoutePreview event={emSaoPaulo} />)

    const times = within(await screen.findByRole('list', { name: 'Tempo até o local' }))
    expect(await times.findByText('12 min')).toBeInTheDocument()
    expect(await times.findByText('34 min')).toBeInTheDocument()
    expect(screen.getByText('Do centro de SP')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledWith(
      emSaoPaulo.id,
      expect.objectContaining({ latitude: -23.5505 }),
      'carro',
      expect.any(AbortSignal),
    )
    expect(times.getByRole('link', { name: /Google Maps/ }).getAttribute('href')).toContain(
      'travelmode=transit',
    )
    expect(screen.getByRole('link', { name: /Ver rota completa/ })).toHaveAttribute(
      'href',
      paths.eventRoute(
        emSaoPaulo.id,
        originSearch({ latitude: -23.5505, longitude: -46.6333, label: 'Centro de São Paulo' }),
      ),
    )
  })

  it('usa a localização do aparelho quando a permissão já foi dada', async () => {
    stubPermission('granted', { latitude: -23.6, longitude: -46.7 })
    const spy = vi.spyOn(rotasApi, 'rota').mockResolvedValue([rota(600, 3000)])
    renderWithRouter(<RoutePreview event={emSaoPaulo} />)

    expect(await screen.findByText('Da sua localização')).toBeInTheDocument()
    expect(spy).toHaveBeenLastCalledWith(
      emSaoPaulo.id,
      { latitude: -23.6, longitude: -46.7 },
      expect.any(String),
      expect.any(AbortSignal),
    )
  })

  it('não calcula a partir do centro quando vai usar a localização do aparelho', async () => {
    stubPermission('granted', { latitude: -23.6, longitude: -46.7 })
    const spy = vi.spyOn(rotasApi, 'rota').mockResolvedValue([rota(600, 3000)])
    renderWithRouter(<RoutePreview event={emSaoPaulo} />)

    await screen.findByText('Da sua localização')
    expect(spy.mock.calls.map(([, partida]) => partida.latitude)).toEqual([-23.6, -23.6])
  })

  it('para eventos longe de SP, só oferece definir a partida', async () => {
    stubPermission('prompt')
    const spy = vi.spyOn(rotasApi, 'rota')
    const noRio = toCultEvent(
      apiEvent({ local: { ...local, cidade: 'Rio de Janeiro', latitude: -22.98, longitude: -43.36 } }),
    )
    renderWithRouter(<RoutePreview event={noRio} />)

    expect(await screen.findByRole('link', { name: /Definir partida/ })).toHaveAttribute(
      'href',
      paths.eventOrigin(noRio.id),
    )
    expect(screen.queryByRole('list', { name: 'Tempo até o local' })).not.toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })
})
