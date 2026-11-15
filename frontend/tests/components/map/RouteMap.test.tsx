import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RouteMap from '@/components/map/RouteMap'
import type { CalculatedRoute } from '@/types'

const rota = (coordinates: [number, number][]): CalculatedRoute => ({
  distancia_metros: 1000,
  duracao_segundos: 600,
  geometria: { type: 'LineString', coordinates },
})

describe('RouteMap', () => {
  it('mostra a partida, o destino e a atribuição com o link para corrigir o mapa', () => {
    render(
      <RouteMap
        destination={{ latitude: -23.6, longitude: -46.72 }}
        destinationLabel="Auditório Ibirapuera"
        origin={{ latitude: -23.58, longitude: -46.65 }}
        routes={[
          rota([
            [-46.65, -23.58],
            [-46.72, -23.6],
          ]),
          rota([
            [-46.65, -23.58],
            [-46.7, -23.59],
            [-46.72, -23.6],
          ]),
        ]}
        selected={1}
      />,
    )
    const map = screen.getByRole('region', { name: 'Mapa do trajeto até o evento' })
    expect(map).toHaveTextContent('OpenStreetMap contributors')
    expect(screen.getByRole('link', { name: 'Corrigir o mapa' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/fixthemap',
    )
    expect(screen.getByRole('img', { name: 'Partida' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Destino: Auditório Ibirapuera' })).toBeInTheDocument()
  })

  it('funciona sem partida, sem destino e sem rotas', () => {
    render(<RouteMap destinationLabel="Local" routes={[]} selected={0} />)
    expect(screen.getByRole('region', { name: 'Mapa do trajeto até o evento' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('troca os marcadores sem duplicar quando a partida muda', () => {
    const props = { destinationLabel: 'Local', routes: [], selected: 0 }
    const { rerender } = render(<RouteMap {...props} origin={{ latitude: -23.6, longitude: -46.7 }} />)
    rerender(<RouteMap {...props} origin={{ latitude: -23.5, longitude: -46.6 }} />)
    expect(screen.getAllByRole('img', { name: 'Partida' })).toHaveLength(1)
  })

  it('não interpreta o nome do local como HTML', () => {
    const nome = 'x"><img src=x onerror="alert(1)"> Teatro'
    const { container } = render(
      <RouteMap
        destination={{ latitude: -23.5, longitude: -46.6 }}
        destinationLabel={nome}
        routes={[]}
        selected={0}
      />,
    )
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(screen.getByRole('img', { name: `Destino: ${nome}` })).toBeInTheDocument()
  })
})
