import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import Origin from '@/pages/Origin'
import { renderWithRouter } from '@tests/render'

const id = 'sp-jazz-blues-festival'

function renderOrigin() {
  return renderWithRouter(
    <Routes>
      <Route path={routes.eventOrigin} element={<Origin />} />
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
})
