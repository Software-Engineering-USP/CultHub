import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import Origin from '@/pages/Origin'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

const id = 'sp-jazz-blues-festival'

function renderOrigin() {
  return renderWithRouter(
    <Routes>
      <Route path={routes.eventOrigin} element={<Origin />} />
      <Route path={routes.eventRoute} element={<h1>Página da rota</h1>} />
    </Routes>,
    { route: paths.eventOrigin(id) },
  )
}

describe('Origin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('"Usar minha localização" registra o pedido no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderOrigin()
    await user.click(screen.getByRole('button', { name: /Usar minha localização/ }))
    expect(log).toHaveBeenCalledWith('Pedir localização do usuário')
  })

  it('Traçar rota envia origem e transporte e abre a página da rota', async () => {
    const plan = vi.spyOn(api.routes, 'plan').mockResolvedValue()
    const { user } = renderOrigin()

    await user.type(screen.getByLabelText('Endereço de partida'), 'Rua Augusta, 100')
    await user.click(screen.getByLabelText('Ônibus'))
    await user.click(screen.getByRole('button', { name: 'Traçar rota' }))

    expect(plan).toHaveBeenCalledWith({ eventId: id, origin: 'Rua Augusta, 100', mode: 'onibus' })
    expect(await screen.findByRole('heading', { name: 'Página da rota' })).toBeInTheDocument()
  })

  it('não traça a rota sem endereço de partida', async () => {
    const plan = vi.spyOn(api.routes, 'plan').mockResolvedValue()
    const { user } = renderOrigin()
    await user.click(screen.getByRole('button', { name: 'Traçar rota' }))
    expect(plan).not.toHaveBeenCalled()
  })
})
