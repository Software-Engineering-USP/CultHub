import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import EventPage from '@/components/events/EventPage'
import { paths, routes } from '@/lib/paths'
import type { EventWithDetails } from '@/types'
import { renderWithRouter } from '@tests/render'

function Page({ event }: { event: EventWithDetails }) {
  return <h1>{event.title}</h1>
}

function renderAt(id: string) {
  return renderWithRouter(
    <Routes>
      <Route path={routes.event} element={<EventPage page={Page} notFoundMessage="Evento sem página." />} />
    </Routes>,
    { route: paths.event(id) },
  )
}

describe('EventPage', () => {
  it('passa o evento da URL para a página', () => {
    renderAt('sp-jazz-blues-festival')
    expect(
      screen.getByRole('heading', { level: 1, name: 'São Paulo Jazz & Blues Festival' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['um evento sem página própria', 'derby-paulista'],
    ['um id desconhecido', 'nao-existe'],
  ])('mostra o aviso para %s', (_, id) => {
    renderAt(id)
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Evento sem página.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para explorar' })).toHaveAttribute('href', paths.home)
    expect(document.title).toBe('Evento não encontrado | CultHub')
  })
})
