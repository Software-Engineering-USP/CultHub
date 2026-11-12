import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import RoutePlan from '@/pages/RoutePlan'
import { catalogApi } from '@/services/catalog'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

const id = 'sp-jazz-blues-festival'

function renderRoutePlan() {
  vi.spyOn(catalogApi, 'event').mockResolvedValue(
    apiEvent({
      id,
      titulo: 'Jazz no Parque',
      local: { nome: 'Auditório Ibirapuera', endereco: '', cidade: 'São Paulo', estado: 'SP' },
    }),
  )
  return renderWithRouter(
    <Routes>
      <Route
        path={routes.eventRoute}
        element={<EventPage page={RoutePlan} notFoundMessage="Evento não encontrado." />}
      />
    </Routes>,
    { route: paths.eventRoute(id) },
  )
}

describe('RoutePlan', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o trajeto, as opções de transporte e os links de volta à origem', async () => {
    renderRoutePlan()
    expect(await screen.findByRole('heading', { level: 1, name: 'Como chegar' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Rota de exemplo | CultHub'))

    const panel = within(screen.getByRole('region', { name: 'Seu trajeto' }))
    const options = within(panel.getByRole('list', { name: /Comparação ilustrativa de transportes/ }))
    expect(options.getAllByRole('listitem')).toHaveLength(3)
    expect(options.getByText(/em destaque/)).toBeInTheDocument()
    expect(panel.getByText('Chegue ao Auditório Ibirapuera')).toBeInTheDocument()

    expect(panel.getByRole('link', { name: 'Alterar' })).toHaveAttribute('href', paths.eventOrigin(id))
    expect(panel.getByRole('link', { name: 'Voltar à definição de origem' })).toHaveAttribute(
      'href',
      paths.eventOrigin(id),
    )
    expect(screen.getByRole('img', { name: /Mapa ilustrativo de uma rota destacada/ })).toBeInTheDocument()
  })

  it('"Abrir no app de mapas" registra a ação com o id do evento', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderRoutePlan()
    await user.click(await screen.findByRole('button', { name: /Abrir no app de mapas/ }))
    expect(log).toHaveBeenCalledWith('Abrir rota no app de mapas', { eventId: id })
  })
})
