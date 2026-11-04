import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FeaturedCarousel from '@/components/events/FeaturedCarousel'
import { events } from '@/data/events'
import { renderWithRouter } from '@tests/render'

const featured = events.filter((event) => event.featured)

describe('FeaturedCarousel', () => {
  it('mostra um item por evento numa região rotulada', () => {
    renderWithRouter(<FeaturedCarousel events={featured} />)
    const carousel = screen.getByRole('region', { name: `${featured.length} experiências em destaque` })
    const items = within(carousel).getAllByRole('group')
    expect(items).toHaveLength(featured.length)
    featured.forEach((event, index) => {
      expect(within(items[index]).getByRole('heading', { name: event.title })).toBeInTheDocument()
    })
  })

  it('tem botões de anterior e próximo', () => {
    renderWithRouter(<FeaturedCarousel events={featured} />)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
  })

  it('só o primeiro card carrega a imagem com prioridade', () => {
    renderWithRouter(<FeaturedCarousel events={featured} />)
    const [first, ...rest] = screen.getAllByRole('img')
    expect(first).not.toHaveAttribute('loading')
    rest.forEach((img) => expect(img).toHaveAttribute('loading', 'lazy'))
  })
})
