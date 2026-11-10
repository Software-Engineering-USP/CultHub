import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import Origin from '@/pages/Origin'
import { api } from '@/services/api'
import { ApiError, catalogApi } from '@/services/catalog'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

const id = 'sp-jazz-blues-festival'

function renderOrigin() {
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
        path={routes.eventOrigin}
        element={<EventPage page={Origin} notFoundMessage="Evento não encontrado." />}
      />
      <Route path={routes.eventRoute} element={<h1>Página da rota</h1>} />
    </Routes>,
    { route: paths.eventOrigin(id) },
  )
}

describe('Origin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o caminho até "Como chegar", o destino e o link para a rota de exemplo', async () => {
    renderOrigin()
    expect(await screen.findByRole('heading', { level: 1, name: 'Como chegar' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Defina sua origem | CultHub'))
    expect(screen.getByRole('link', { name: 'Voltar para o evento' })).toHaveAttribute(
      'href',
      paths.event(id),
    )
    expect(screen.getByRole('region', { name: 'De onde você vai sair?' })).toHaveTextContent(
      'Auditório Ibirapuera',
    )
    expect(screen.getByLabelText('Carro')).toBeChecked()
    expect(screen.getByRole('link', { name: /Ver rota de exemplo/ })).toHaveAttribute(
      'href',
      paths.eventRoute(id),
    )
    expect(screen.getByRole('img', { name: /Mapa ilustrativo da região do Ibirapuera/ })).toBeInTheDocument()
  })

  it('mostra o aviso quando a API responde que o evento não existe', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new ApiError('Não encontrado. (404)', 404))
    renderWithRouter(
      <Routes>
        <Route
          path={routes.eventOrigin}
          element={<EventPage page={Origin} notFoundMessage="Evento não encontrado." />}
        />
      </Routes>,
      { route: paths.eventOrigin('nao-existe') },
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
  })

  it('"Usar minha localização" registra o pedido no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: /Usar minha localização/ }))
    expect(log).toHaveBeenCalledWith('Pedir localização do usuário')
  })

  it('Traçar rota envia origem e transporte e abre a página da rota', async () => {
    const plan = vi.spyOn(api.routes, 'plan').mockResolvedValue()
    const { user } = renderOrigin()

    await user.type(await screen.findByLabelText('Endereço de partida'), 'Rua Augusta, 100')
    await user.click(screen.getByLabelText('Ônibus'))
    await user.click(await screen.findByRole('button', { name: 'Traçar rota' }))

    expect(plan).toHaveBeenCalledWith({ eventId: id, origin: 'Rua Augusta, 100', mode: 'onibus' })
    expect(await screen.findByRole('heading', { name: 'Página da rota' })).toBeInTheDocument()
  })

  it('não traça a rota sem endereço de partida', async () => {
    const plan = vi.spyOn(api.routes, 'plan').mockResolvedValue()
    const { user } = renderOrigin()
    await user.click(await screen.findByRole('button', { name: 'Traçar rota' }))
    expect(plan).not.toHaveBeenCalled()
  })
})
