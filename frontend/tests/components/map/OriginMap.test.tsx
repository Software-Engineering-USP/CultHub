import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OriginMap from '@/components/map/OriginMap'

describe('OriginMap', () => {
  it('mostra o mapa com a atribuição do OpenStreetMap e o local do evento', () => {
    render(
      <OriginMap
        destination={{ latitude: -23.5874, longitude: -46.6576 }}
        destinationLabel="Auditório Ibirapuera"
        origin={null}
        onOriginChange={vi.fn()}
      />,
    )
    const map = screen.getByRole('region', { name: 'Mapa para escolher o ponto de partida' })
    expect(map).toHaveTextContent('OpenStreetMap contributors')
    expect(screen.getByRole('img', { name: 'Destino: Auditório Ibirapuera' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Partida' })).not.toBeInTheDocument()
  })

  it('põe, move e tira o pino de partida', () => {
    const props = { destinationLabel: 'Local', onOriginChange: vi.fn() }
    const { rerender } = render(<OriginMap {...props} origin={{ latitude: -23.6, longitude: -46.7 }} />)
    expect(screen.getByRole('img', { name: 'Partida' })).toBeInTheDocument()

    rerender(<OriginMap {...props} origin={{ latitude: -23.5, longitude: -46.6 }} />)
    expect(screen.getAllByRole('img', { name: 'Partida' })).toHaveLength(1)

    rerender(<OriginMap {...props} origin={null} />)
    expect(screen.queryByRole('img', { name: 'Partida' })).not.toBeInTheDocument()
  })
})
