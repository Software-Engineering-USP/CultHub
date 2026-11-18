import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EventsMap from '@/components/map/EventsMap'
import { findEvent } from '@/data/events'

const evento = { ...findEvent('sp-jazz-blues-festival')!, location: { latitude: -23.58, longitude: -46.65 } }

describe('EventsMap', () => {
  it('põe um pino por evento com local, com a atribuição do OpenStreetMap', () => {
    render(<EventsMap events={[evento]} userPosition={null} recenter={0} onSelect={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Mapa dos eventos' })).toHaveTextContent(
      'OpenStreetMap contributors',
    )
    expect(screen.getByRole('img', { name: evento.title })).toBeInTheDocument()
  })

  it('não interpreta o título do evento como HTML', () => {
    const titulo = '<img src=x onerror="alert(1)"> Show'
    const { container } = render(
      <EventsMap
        events={[{ ...evento, title: titulo }]}
        userPosition={null}
        recenter={0}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('img', { name: titulo })).toBeInTheDocument()
    expect(container.querySelector('img[src="x"]')).toBeNull()
  })

  it('marca a posição da pessoa e troca o pino quando ela muda', () => {
    const props = { events: [], recenter: 0, onSelect: vi.fn() }
    const { rerender } = render(<EventsMap {...props} userPosition={{ latitude: -23.6, longitude: -46.7 }} />)
    expect(screen.getByRole('img', { name: 'Você está aqui' })).toBeInTheDocument()

    rerender(<EventsMap {...props} userPosition={{ latitude: -23.5, longitude: -46.6 }} />)
    expect(screen.getAllByRole('img', { name: 'Você está aqui' })).toHaveLength(1)
  })
})
