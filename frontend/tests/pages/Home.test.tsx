import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { events } from '@/data/events'
import { categoryOrder } from '@/lib/categories'
import * as demo from '@/lib/demo'
import { paths } from '@/lib/paths'
import Home from '@/pages/Home'
import { renderWithRouter } from '@tests/render'

describe('Home', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('"Minha Localização" registra o pedido no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderWithRouter(<Home />)
    await user.click(screen.getByRole('button', { name: /Minha Localização/ }))
    expect(log).toHaveBeenCalledWith('Pedir localização do usuário')
  })

  it('mostra o título, o mapa e um card para cada evento', () => {
    renderWithRouter(<Home />)
    expect(screen.getByRole('heading', { level: 1, name: 'Mapa de Eventos' })).toBeInTheDocument()
    expect(document.title).toBe('CultHub | Explore São Paulo')
    expect(screen.getByRole('figure')).toHaveTextContent('OpenStreetMap contributors')

    expect(screen.getByText(`Exibindo ${events.length} evento(s) encontrado(s)`)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: `Conhecer ${events[0].title}` })[0]).toHaveAttribute(
      'href',
      paths.event(events[0].id),
    )
  })

  it('mostra a legenda do mapa e os destaques no carrossel', () => {
    renderWithRouter(<Home />)
    expect(
      within(screen.getByRole('list', { name: 'Legenda de categorias' })).getAllByRole('listitem'),
    ).toHaveLength(categoryOrder.length)
    expect(screen.getByRole('region', { name: /experiências em destaque/ })).toBeInTheDocument()
  })

  it('mostra o mapa interativo do OpenStreetMap com os créditos', () => {
    renderWithRouter(<Home />)
    expect(screen.getByTitle('Mapa OpenStreetMap de São Paulo')).toHaveAttribute(
      'src',
      expect.stringContaining('openstreetmap.org'),
    )
    expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument()
  })
})
