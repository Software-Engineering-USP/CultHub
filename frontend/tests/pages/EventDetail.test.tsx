import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import EventDetail from '@/pages/EventDetail'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

function renderEvent(id = 'sp-jazz-blues-festival') {
  return renderWithRouter(
    <Routes>
      <Route path={routes.event} element={<EventDetail />} />
    </Routes>,
    { route: paths.event(id) },
  )
}

describe('EventDetail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Salvar chama a API com o id do evento', async () => {
    const save = vi.spyOn(api.events, 'save').mockResolvedValue()
    const { user } = renderEvent()
    await user.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(save).toHaveBeenCalledWith('sp-jazz-blues-festival')
  })

  it('Compartilhar registra a ação no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderEvent()
    await user.click(screen.getByRole('button', { name: /Compartilhar/ }))
    expect(log).toHaveBeenCalledWith('Compartilhar evento', { eventId: 'sp-jazz-blues-festival' })
  })

  it('Responder um comentário registra a ação no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderEvent()
    await user.click(screen.getByRole('button', { name: 'Responder a Rafael Martins' }))
    expect(log).toHaveBeenCalledWith('Abrir resposta ao comentário', { commentId: 'c2' })
  })
})
