import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EventCard from '@/components/events/EventCard'
import { findEvent } from '@/data/events'
import { paths } from '@/lib/paths'
import { toCultEvent } from '@/services/catalog'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

const jazz = findEvent('sp-jazz-blues-festival')!
const virada = findEvent('virada-cultural')!

describe('EventCard', () => {
  it('mostra título, descrição, local, horário, preço e categoria', () => {
    renderWithRouter(<EventCard event={jazz} />)
    expect(screen.getByRole('heading', { level: 3, name: jazz.title })).toBeInTheDocument()
    expect(screen.getByText(jazz.description)).toHaveClass('line-clamp-2')
    expect(screen.getByText(jazz.venue)).toBeInTheDocument()
    expect(screen.getByText(jazz.schedule)).toBeInTheDocument()
    expect(screen.getByText(jazz.price)).toHaveClass('text-maroon')
    expect(screen.getByText('Música')).toHaveClass('text-label-music')
  })

  it('imagem, título e seta levam à página do evento', () => {
    renderWithRouter(<EventCard event={virada} />)
    const href = paths.event(virada.id)
    expect(screen.getByRole('link', { name: `Conhecer ${virada.title}` })).toHaveAttribute('href', href)
    expect(screen.getByRole('link', { name: virada.title })).toHaveAttribute('href', href)
    expect(screen.getByRole('link', { name: `Ver detalhes do ${virada.title}` })).toHaveAttribute(
      'href',
      href,
    )
  })

  it('não cria links de detalhe quando o evento não pertence ao catálogo', () => {
    renderWithRouter(<EventCard event={jazz} detailsLink={false} />)

    expect(screen.queryByRole('link', { name: `Conhecer ${jazz.title}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: jazz.title })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: `Ver detalhes do ${jazz.title}` })).not.toBeInTheDocument()
  })

  it('preço gratuito aparece em verde', () => {
    renderWithRouter(<EventCard event={virada} />)
    expect(screen.getByText('Gratuito')).toHaveClass('text-success-foreground')
  })

  it('preço desconhecido não recebe a cor de evento gratuito', () => {
    const event = toCultEvent(apiEvent({ situacao_preco: 'desconhecido', faixas_preco: [] }))
    renderWithRouter(<EventCard event={event} />)
    expect(screen.getByText('Preço não informado')).toHaveClass('text-maroon')
  })

  it('carrega a imagem com lazy loading, exceto quando priority', () => {
    const { unmount } = renderWithRouter(<EventCard event={jazz} />)
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
    unmount()
    renderWithRouter(<EventCard event={jazz} priority />)
    expect(screen.getByRole('img')).not.toHaveAttribute('loading')
  })
})
