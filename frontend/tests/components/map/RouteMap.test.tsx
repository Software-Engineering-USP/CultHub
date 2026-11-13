import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RouteMap from '@/components/map/RouteMap'

describe('RouteMap', () => {
  it('mostra partida, destino, trajeto e a atribuição com o link para corrigir o mapa', () => {
    const { container } = render(
      <RouteMap
        origin={{ latitude: -23.6, longitude: -46.7 }}
        destination={{ latitude: -23.58, longitude: -46.65 }}
        destinationLabel="Auditório Ibirapuera"
        route={{
          distancia_metros: 1000,
          duracao_segundos: 600,
          geometria: {
            type: 'LineString',
            coordinates: [
              [-46.7, -23.6],
              [-46.65, -23.58],
            ],
          },
        }}
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
    expect(container.querySelector('path.stroke-maroon')).not.toBeNull()
  })

  it('funciona sem destino nem trajeto', () => {
    render(<RouteMap origin={{ latitude: -23.6, longitude: -46.7 }} destinationLabel="Local" />)
    expect(screen.getByRole('img', { name: 'Partida' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Destino/ })).not.toBeInTheDocument()
  })
})
