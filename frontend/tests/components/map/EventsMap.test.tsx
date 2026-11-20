import { fireEvent, render, screen, within } from '@testing-library/react'
import L from 'leaflet'
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

  it('agrupa eventos no mesmo local, destaca categorias diferentes e deixa escolher o evento', async () => {
    const onSelect = vi.fn()
    const show = {
      ...evento,
      id: 'show-music',
      title: 'Show',
      category: 'music' as const,
      eventDate: '2040-03-10',
      eventTime: '20:00:00',
    }
    const play = {
      ...evento,
      id: 'play-theater',
      title: 'Peça',
      category: 'theater' as const,
      eventDate: '2040-03-11',
      eventTime: '19:30:00',
      location: show.location,
    }
    render(<EventsMap events={[show, play]} userPosition={null} recenter={0} onSelect={onSelect} />)

    const map = screen.getByRole('region', { name: 'Mapa dos eventos' })
    const pin = within(map).getByRole('img', { name: /2 eventos neste local/ })
    expect(pin.querySelectorAll('svg')).toHaveLength(2)

    fireEvent.click(pin.closest('.leaflet-marker-icon')!)
    const showChoice = await screen.findByRole('button', { name: 'Show — 10/03/2040 às 20:00' })
    const playChoice = screen.getByRole('button', { name: 'Peça — 11/03/2040 às 19:30' })
    expect(showChoice).toHaveClass('bg-cat-music')
    expect(playChoice).toHaveClass('bg-cat-theater')

    fireEvent.click(playChoice)
    expect(onSelect).toHaveBeenCalledWith('play-theater')
  })

  it('remove registros duplicados com o mesmo título e horário do pin agrupado', () => {
    const repeated = {
      ...evento,
      id: 'festival-2',
      eventDate: '2040-03-10',
      eventTime: '20:00:00',
    }
    const original = { ...evento, id: 'festival-1', eventDate: '2040-03-10', eventTime: '20:00:00' }
    const { container } = render(
      <EventsMap events={[original, repeated]} userPosition={null} recenter={0} onSelect={vi.fn()} />,
    )
    const marker = container.querySelector('.leaflet-marker-icon [role="img"]')

    expect(marker).toHaveAttribute('aria-label', original.title)
    expect(marker?.querySelectorAll('svg')).toHaveLength(1)
  })

  it('marca a posição da pessoa e troca o pino quando ela muda', () => {
    const props = { events: [], recenter: 0, onSelect: vi.fn() }
    const { rerender } = render(<EventsMap {...props} userPosition={{ latitude: -23.6, longitude: -46.7 }} />)
    expect(screen.getByRole('img', { name: 'Você está aqui' })).toBeInTheDocument()

    rerender(<EventsMap {...props} userPosition={{ latitude: -23.5, longitude: -46.6 }} />)
    expect(screen.getAllByRole('img', { name: 'Você está aqui' })).toHaveLength(1)
  })

  it('mostra uma dica só no pino (sem o title nativo do navegador)', () => {
    const { container } = render(
      <EventsMap events={[evento]} userPosition={null} recenter={0} onSelect={vi.fn()} />,
    )
    const marker = container.querySelector('.leaflet-marker-icon')
    expect(marker).not.toHaveAttribute('title')
  })

  it('"carregar mais" só acrescenta pinos e mantém os que já estavam', () => {
    const props = { userPosition: null, recenter: 0, onSelect: vi.fn() }
    const outro = {
      ...evento,
      id: 'outro',
      title: 'Outro show',
      location: { latitude: -23.5, longitude: -46.6 },
    }
    const { rerender } = render(<EventsMap {...props} events={[evento]} />)
    const antes = screen.getByRole('img', { name: evento.title })

    rerender(<EventsMap {...props} events={[evento, outro]} />)

    expect(screen.getByRole('img', { name: evento.title })).toBe(antes)
    expect(screen.getByRole('img', { name: 'Outro show' })).toBeInTheDocument()

    rerender(<EventsMap {...props} events={[outro]} />)
    expect(screen.queryByRole('img', { name: evento.title })).not.toBeInTheDocument()
  })

  it('centraliza na primeira posição e no clique, mas não quando a posição só se atualiza', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView')
    const props = { events: [], onSelect: vi.fn() }
    const { rerender } = render(<EventsMap {...props} userPosition={null} recenter={0} />)
    setView.mockClear()

    rerender(<EventsMap {...props} userPosition={{ latitude: -23.6, longitude: -46.7 }} recenter={0} />)
    expect(setView).toHaveBeenCalledOnce()

    rerender(<EventsMap {...props} userPosition={{ latitude: -23.61, longitude: -46.71 }} recenter={0} />)
    expect(setView).toHaveBeenCalledOnce()

    rerender(<EventsMap {...props} userPosition={{ latitude: -23.61, longitude: -46.71 }} recenter={1} />)
    expect(setView).toHaveBeenCalledTimes(2)
    setView.mockRestore()
  })
})
