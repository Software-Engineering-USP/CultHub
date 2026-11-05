import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import RoutePlan from '@/pages/RoutePlan'
import { renderWithRouter } from '@tests/render'

const id = 'sp-jazz-blues-festival'

function renderRoutePlan() {
  return renderWithRouter(
    <Routes>
      <Route path={routes.eventRoute} element={<RoutePlan />} />
    </Routes>,
    { route: paths.eventRoute(id) },
  )
}

describe('RoutePlan', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('"Abrir no app de mapas" registra a ação com o id do evento', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderRoutePlan()
    await user.click(screen.getByRole('button', { name: /Abrir no app de mapas/ }))
    expect(log).toHaveBeenCalledWith('Abrir rota no app de mapas', { eventId: id })
  })
})
