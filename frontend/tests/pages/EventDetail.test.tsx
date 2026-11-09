import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import EventDetail from '@/pages/EventDetail'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

function renderEvent(id = 'sp-jazz-blues-festival') {
  return renderWithRouter(
    <Routes>
      <Route
        path={routes.event}
        element={<EventPage page={EventDetail} notFoundMessage="Evento não encontrado." />}
      />
    </Routes>,
    { route: paths.event(id) },
  )
}

describe('EventDetail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o evento, o caminho da página e os links para planejar a visita', () => {
    renderEvent()
    const id = 'sp-jazz-blues-festival'
    expect(
      screen.getByRole('heading', { level: 1, name: 'São Paulo Jazz & Blues Festival' }),
    ).toBeInTheDocument()
    expect(document.title).toBe('São Paulo Jazz & Blues Festival | CultHub')
    expect(screen.getByRole('link', { name: 'Voltar para explorar' })).toHaveAttribute('href', paths.home)

    const breadcrumb = within(screen.getByRole('navigation', { name: 'Caminho da página' }))
    expect(breadcrumb.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', paths.home)
    expect(breadcrumb.getByText('Música')).toBeInTheDocument()
    expect(breadcrumb.getByText('Jazz & Blues')).toHaveAttribute('aria-current', 'page')

    expect(screen.getByRole('link', { name: /Ver local no mapa/ })).toHaveAttribute(
      'href',
      paths.eventOrigin(id),
    )
    expect(screen.getByRole('link', { name: /Planejar minha visita/ })).toHaveAttribute(
      'href',
      paths.eventOrigin(id),
    )
    expect(screen.getByRole('link', { name: 'Ver rota completa de exemplo' })).toHaveAttribute(
      'href',
      paths.eventRoute(id),
    )
    expect(screen.getByRole('heading', { name: 'Clima no horário do evento' })).toBeInTheDocument()
  })

  it('mostra o aviso para eventos sem página de detalhes', () => {
    renderEvent('derby-paulista')
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('Evento não encontrado.')).toBeInTheDocument()
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

  it('Publicar comentário envia o texto e limpa o campo', async () => {
    const create = vi.spyOn(api.comments, 'create').mockResolvedValue()
    const { user } = renderEvent()
    const campo = screen.getByLabelText('Seu comentário sobre o evento')

    await user.type(campo, 'Que noite!')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(create).toHaveBeenCalledWith('sp-jazz-blues-festival', 'Que noite!')
    expect(campo).toHaveValue('')
  })

  it('não publica comentário vazio', async () => {
    const create = vi.spyOn(api.comments, 'create').mockResolvedValue()
    const { user } = renderEvent()
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))
    expect(create).not.toHaveBeenCalled()
  })
})
