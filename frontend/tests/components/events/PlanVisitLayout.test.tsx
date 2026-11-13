import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PlanVisitLayout, { PlanVisitPanel } from '@/components/events/PlanVisitLayout'
import { findEvent } from '@/data/events'
import { paths } from '@/lib/paths'
import { renderWithRouter } from '@tests/render'

const event = findEvent('sp-jazz-blues-festival')!

function renderLayout() {
  return renderWithRouter(
    <PlanVisitLayout
      event={event}
      description="Descrição da página"
      status={<span>Selo</span>}
      map={<img src="/assets/mapa.png" alt="Mapa de teste" />}
    >
      <PlanVisitPanel aria-label="Painel de teste">Conteúdo do painel</PlanVisitPanel>
    </PlanVisitLayout>,
  )
}

describe('PlanVisitLayout', () => {
  it('volta para o evento e mostra o caminho até "Como chegar"', () => {
    renderLayout()
    expect(screen.getByRole('link', { name: 'Voltar para o evento' })).toHaveAttribute(
      'href',
      paths.event(event.id),
    )

    const breadcrumb = within(screen.getByRole('navigation', { name: 'Caminho da página' }))
    expect(breadcrumb.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', paths.home)
    expect(breadcrumb.getByRole('link', { name: 'Jazz & Blues' })).toHaveAttribute(
      'href',
      paths.event(event.id),
    )
    expect(breadcrumb.getByText('Como chegar')).toHaveAttribute('aria-current', 'page')
  })

  it('mostra título, descrição, selo, resumo do evento, painel, mapa e clima', () => {
    renderLayout()
    expect(screen.getByRole('heading', { level: 1, name: 'Como chegar' })).toBeInTheDocument()
    expect(screen.getByText('Descrição da página')).toBeInTheDocument()
    expect(screen.getByText('Selo')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Resumo do evento' })).toHaveTextContent(event.title)
    expect(screen.getByRole('region', { name: 'Painel de teste' })).toHaveTextContent('Conteúdo do painel')
    expect(screen.getByRole('img', { name: 'Mapa de teste' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Previsão do tempo para o evento' })).toBeInTheDocument()
  })
})
