import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import EventDetail from '@/pages/EventDetail'
import { ApiError as ActionApiError, api } from '@/services/api'
import { catalogApi, ApiError as CatalogApiError, toCultEvent } from '@/services/catalog'
import type { ApiEvent } from '@/services/catalog'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

function renderEvent(
  id = 'sp-jazz-blues-festival',
  authUser?: NonNullable<Parameters<typeof renderWithRouter>[1]>['authUser'],
  overrides: Partial<ApiEvent> = {},
) {
  vi.spyOn(catalogApi, 'event').mockResolvedValue(
    apiEvent({
      id,
      titulo: 'São Paulo Jazz & Blues Festival',
      descricao: 'Descrição do show.',
      ...overrides,
    }),
  )
  return renderWithRouter(
    <Routes>
      <Route
        path={routes.event}
        element={<EventPage page={EventDetail} notFoundMessage="Evento não encontrado." />}
      />
    </Routes>,
    { route: paths.event(id), authUser },
  )
}

describe('EventDetail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o evento, o caminho da página e os links para planejar a visita', async () => {
    renderEvent()
    const id = 'sp-jazz-blues-festival'
    expect(
      await screen.findByRole('heading', { level: 1, name: 'São Paulo Jazz & Blues Festival' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('São Paulo Jazz & Blues Festival | CultHub'))
    expect(screen.getByRole('link', { name: 'Voltar para explorar' })).toHaveAttribute('href', paths.home)

    const breadcrumb = within(screen.getByRole('navigation', { name: 'Caminho da página' }))
    expect(breadcrumb.getByRole('link', { name: 'Explorar' })).toHaveAttribute('href', paths.home)
    expect(breadcrumb.getByText('Música')).toBeInTheDocument()
    expect(breadcrumb.getByText('São Paulo Jazz & Blues Festival')).toHaveAttribute('aria-current', 'page')

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

  it('mostra aviso apenas quando a API responde que o evento não existe', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new CatalogApiError('Não encontrado.', 404))
    renderWithRouter(
      <Routes>
        <Route
          path={routes.event}
          element={<EventPage page={EventDetail} notFoundMessage="Evento não encontrado." />}
        />
      </Routes>,
      { route: paths.event('nao-existe') },
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Evento não encontrado.')).toBeInTheDocument()
  })

  it.each([
    [{ removido: true }, 'Este evento não está mais disponível no catálogo.'],
    [{ situacao: 'cancelled' }, 'Este evento foi cancelado.'],
    [{ data_inicio: '2020-01-01' }, 'Este evento já foi encerrado.'],
  ])('avisa quando o evento está indisponível', async (overrides, message) => {
    vi.spyOn(catalogApi, 'event').mockResolvedValue(apiEvent(overrides))
    renderWithRouter(
      <Routes>
        <Route
          path={routes.event}
          element={<EventPage page={EventDetail} notFoundMessage="Evento não encontrado." />}
        />
      </Routes>,
      { route: paths.event('evento-indisponivel') },
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('salva e remove o evento dos salvos pela API', async () => {
    const save = vi.spyOn(api.events, 'save').mockResolvedValue()
    const unsave = vi.spyOn(api.events, 'unsave').mockResolvedValue()
    const { user } = renderEvent()
    await user.click(await screen.findByRole('button', { name: /Salvar/ }))
    expect(save).toHaveBeenCalledWith('sp-jazz-blues-festival')

    const savedButton = await screen.findByRole('button', { name: 'Salvo' })
    expect(savedButton).toHaveAttribute('aria-pressed', 'true')
    await user.click(savedButton)
    expect(unsave).toHaveBeenCalledWith('sp-jazz-blues-festival')
    expect(await screen.findByRole('button', { name: 'Salvar' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('confirma e remove a presença atualizando o total', async () => {
    const attend = vi.spyOn(api.events, 'attend').mockResolvedValue()
    const unattend = vi.spyOn(api.events, 'unattend').mockResolvedValue()
    const { user } = renderEvent()

    await user.click(await screen.findByRole('button', { name: 'Vou' }))
    expect(attend).toHaveBeenCalledWith('sp-jazz-blues-festival')
    expect(await screen.findByRole('button', { name: 'Vou!' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 pessoa confirmou presença.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Vou!' }))
    expect(unattend).toHaveBeenCalledWith('sp-jazz-blues-festival')
    expect(await screen.findByText('0 pessoas confirmaram presença.')).toBeInTheDocument()
  })

  it('inicia com os estados e o total retornados pelo backend', async () => {
    renderEvent('evento-ja-marcado', undefined, {
      salvo: true,
      presenca: true,
      total_presencas: 7,
    })

    expect(await screen.findByRole('button', { name: 'Salvo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vou!' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('7 pessoas confirmaram presença.')).toBeInTheDocument()
  })

  it('usa valores padrão se o detalhe não incluir as marcações', () => {
    const event = {
      ...toCultEvent(apiEvent()),
      saved: undefined,
      attending: undefined,
      attendanceCount: undefined,
    }
    renderWithRouter(<EventDetail event={event} />)

    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Vou' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0 pessoas confirmaram presença.')).toBeInTheDocument()
  })

  it('pede login antes de salvar ou confirmar presença', async () => {
    const save = vi.spyOn(api.events, 'save')
    const attend = vi.spyOn(api.events, 'attend')
    const { user } = renderEvent('sp-jazz-blues-festival', null)

    await user.click(await screen.findByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Entre na sua conta para salvar eventos.')
    await user.click(screen.getByRole('button', { name: 'Vou' }))
    expect(screen.getByRole('status')).toHaveTextContent('Entre na sua conta para confirmar presença.')
    expect(save).not.toHaveBeenCalled()
    expect(attend).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Entre na sua conta' })).toHaveAttribute('href', paths.signIn)
  })

  it('mostra erros devolvidos pela API ao salvar e confirmar presença', async () => {
    vi.spyOn(api.events, 'save').mockRejectedValue(new Error('Falha ao salvar.'))
    vi.spyOn(api.events, 'attend').mockRejectedValue(new Error('Falha ao confirmar.'))
    const { user } = renderEvent()

    await user.click(await screen.findByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Não foi possível atualizar os eventos salvos.',
    )
    await user.click(screen.getByRole('button', { name: 'Vou' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi possível atualizar sua presença.')
  })

  it('mostra mensagens específicas de erro retornadas pelo backend', async () => {
    vi.spyOn(api.events, 'save').mockRejectedValue(new ActionApiError('Evento removido.', 409))
    vi.spyOn(api.events, 'attend').mockRejectedValue(new ActionApiError('Evento encerrado.', 409))
    const { user } = renderEvent()

    await user.click(await screen.findByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Evento removido.')
    await user.click(screen.getByRole('button', { name: 'Vou' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Evento encerrado.')
  })

  it('Compartilhar registra a ação no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderEvent()
    await user.click(await screen.findByRole('button', { name: /Compartilhar/ }))
    expect(log).toHaveBeenCalledWith('Compartilhar evento', { eventId: 'sp-jazz-blues-festival' })
  })

  it('Responder um comentário registra a ação no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderEvent()
    await user.click(await screen.findByRole('button', { name: 'Responder a Rafael Martins' }))
    expect(log).toHaveBeenCalledWith('Abrir resposta ao comentário', { commentId: 'c2' })
  })

  it('Publicar comentário envia o texto e limpa o campo', async () => {
    const create = vi.spyOn(api.comments, 'create').mockResolvedValue()
    const { user } = renderEvent()
    const campo = await screen.findByLabelText('Seu comentário sobre o evento')

    await user.type(campo, 'Que noite!')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(create).toHaveBeenCalledWith('sp-jazz-blues-festival', 'Que noite!')
    expect(campo).toHaveValue('')
  })

  it('não publica comentário vazio', async () => {
    const create = vi.spyOn(api.comments, 'create').mockResolvedValue()
    const { user } = renderEvent()
    await user.click(await screen.findByRole('button', { name: 'Publicar comentário' }))
    expect(create).not.toHaveBeenCalled()
  })
})
