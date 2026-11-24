import { screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import * as demo from '@/lib/demo'
import { paths, routes } from '@/lib/paths'
import EventDetail from '@/pages/EventDetail'
import { ApiError as ActionApiError, api } from '@/services/api'
import { catalogApi, ApiError as CatalogApiError, toCultEvent } from '@/services/catalog'
import type { ApiEvent } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'
import { apiAttendee } from '@tests/fixtures/attendees'
import { apiEvent } from '@tests/fixtures/catalog'
import { apiComment, commentPage } from '@tests/fixtures/comments'
import { renderWithRouter } from '@tests/render'

function renderEvent(
  id = 'sp-jazz-blues-festival',
  authUser?: NonNullable<Parameters<typeof renderWithRouter>[1]>['authUser'],
  overrides: Partial<ApiEvent> = {},
) {
  vi.spyOn(rotasApi, 'rota').mockResolvedValue([])
  if (!vi.isMockFunction(api.comments.list)) {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([apiComment()]))
  }
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
  beforeEach(() => {
    vi.spyOn(api.agenda, 'attendees').mockResolvedValue(commentPage([]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra quem vai e recarrega a lista ao confirmar presença', async () => {
    const attendees = vi
      .spyOn(api.agenda, 'attendees')
      .mockResolvedValueOnce(commentPage([apiAttendee()]))
      .mockResolvedValueOnce(
        commentPage([apiAttendee({ id: 'livia', nome: 'Lívia Costa', iniciais: 'LC' }), apiAttendee()]),
      )
    vi.spyOn(api.events, 'attend').mockResolvedValue()
    const { user } = renderEvent('sp-jazz-blues-festival', undefined, { total_presencas: 1 })

    const section = within(await screen.findByRole('region', { name: 'Quem vai' }))
    expect(await section.findByRole('link', { name: 'Rafael Martins' })).toHaveAttribute(
      'href',
      paths.user('rafael-martins'),
    )
    expect(attendees).toHaveBeenCalledWith('sp-jazz-blues-festival', 1)

    await user.click(screen.getByRole('button', { name: 'Vou' }))

    expect(await section.findByRole('link', { name: 'Lívia Costa' })).toBeInTheDocument()
    expect(attendees).toHaveBeenCalledTimes(2)
    expect(screen.getByText('2 pessoas confirmaram presença.')).toBeInTheDocument()
  })

  it('visitante vê só o total e o convite para entrar e ver quem vai', async () => {
    const attendees = vi.spyOn(api.agenda, 'attendees')
    renderEvent('sp-jazz-blues-festival', null, { total_presencas: 3 })

    expect(await screen.findByText('3 pessoas confirmaram presença.')).toBeInTheDocument()
    expect(screen.getByText(/para salvar o evento, confirmar presença e ver quem vai\./)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Quem vai' })).not.toBeInTheDocument()
    expect(attendees).not.toHaveBeenCalled()
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
    expect(await screen.findByRole('link', { name: 'Escolher outra partida' })).toHaveAttribute(
      'href',
      paths.eventOrigin(id),
    )
    expect(screen.getByRole('heading', { name: 'Clima no horário do evento' })).toBeInTheDocument()
  })

  it('mostra o link oficial no lugar do preço desconhecido', async () => {
    renderEvent(undefined, undefined, {
      situacao_preco: 'desconhecido',
      faixas_preco: [],
      url_externa: 'https://www.ticketmaster.com.br/evento',
    })

    const link = await screen.findByRole('link', {
      name: 'Link oficial para São Paulo Jazz & Blues Festival',
    })
    expect(link).toHaveAttribute('href', 'https://www.ticketmaster.com.br/evento')
    expect(link).toHaveClass('flex', 'w-fit')
    expect(screen.queryByText('Preço não informado')).not.toBeInTheDocument()
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

  it('lista os comentários do evento com as respostas', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(
      commentPage([
        apiComment({
          respostas: [
            apiComment({
              id: 'r1',
              nivel: 1,
              resposta_a: 'c1',
              autor: { id: 'ana', nome: 'Ana Souza', iniciais: 'AS' },
              texto: 'Vamos juntos!',
            }),
          ],
        }),
      ]),
    )
    renderEvent()

    const comment = await screen.findByRole('article', { name: 'Comentário de Rafael Martins' })
    expect(within(comment).getByText('Gostei da proposta!')).toBeInTheDocument()
    expect(within(comment).getByRole('article', { name: 'Comentário de Ana Souza' })).toHaveTextContent(
      'Vamos juntos!',
    )
    expect(screen.getByText(/1 comentário •/)).toBeInTheDocument()
    expect(api.comments.list).toHaveBeenCalledWith('sp-jazz-blues-festival', 1)
  })

  it('mostra o aviso quando não há comentários', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([]))
    renderEvent()
    expect(
      await screen.findByText('Seja a primeira pessoa a comentar sobre este evento.'),
    ).toBeInTheDocument()
  })

  it('Publicar comentário envia o texto, mostra o comentário e limpa o campo', async () => {
    const create = vi
      .spyOn(api.comments, 'create')
      .mockResolvedValue(apiComment({ id: 'novo', texto: 'Que noite!', meu: true }))
    const { user } = renderEvent()
    const campo = await screen.findByLabelText('Seu comentário sobre o evento')

    await user.type(campo, '  Que noite!  ')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(create).toHaveBeenCalledWith('sp-jazz-blues-festival', 'Que noite!')
    expect(await screen.findByText('Que noite!')).toBeInTheDocument()
    expect(campo).toHaveValue('')
  })

  it('mostra o erro da API e mantém o texto ao falhar a publicação', async () => {
    vi.spyOn(api.comments, 'create').mockRejectedValue(
      new ActionApiError('Muitas requisições. Tente de novo em instantes.', 429),
    )
    const { user } = renderEvent()
    const campo = await screen.findByLabelText('Seu comentário sobre o evento')

    await user.type(campo, 'Que noite!')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas requisições. Tente de novo em instantes.',
    )
    expect(campo).toHaveValue('Que noite!')
  })

  it('não publica comentário vazio', async () => {
    const create = vi.spyOn(api.comments, 'create')
    const { user } = renderEvent()
    await user.click(await screen.findByRole('button', { name: 'Publicar comentário' }))
    expect(create).not.toHaveBeenCalled()
  })

  it('visitante vê os comentários, mas não pode comentar nem responder', async () => {
    renderEvent(undefined, null)
    await screen.findByRole('article', { name: 'Comentário de Rafael Martins' })
    expect(screen.getByLabelText('Seu comentário sobre o evento')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Publicar comentário' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Responder/ })).not.toBeInTheDocument()
  })

  it('Responder abre o campo e envia a resposta', async () => {
    const reply = vi
      .spyOn(api.comments, 'reply')
      .mockResolvedValue(
        apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1', texto: 'Também quero ir!', meu: true }),
      )
    const { user } = renderEvent()

    await user.click(await screen.findByRole('button', { name: 'Responder a Rafael Martins' }))
    await user.type(screen.getByLabelText('Sua resposta a Rafael Martins'), 'Também quero ir!')
    await user.click(screen.getByRole('button', { name: 'Responder' }))

    expect(reply).toHaveBeenCalledWith('c1', 'Também quero ir!')
    expect(await screen.findByText('Também quero ir!')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sua resposta a Rafael Martins')).not.toBeInTheDocument()
  })

  it('o autor edita e exclui o próprio comentário', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([apiComment({ meu: true })]))
    vi.spyOn(api.comments, 'update').mockResolvedValue(
      apiComment({ meu: true, texto: 'Texto novo', editado_em: '2026-11-16T10:00:00Z' }),
    )
    const remove = vi.spyOn(api.comments, 'remove').mockResolvedValue()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderEvent()

    const comment = await screen.findByRole('article', { name: 'Comentário de Rafael Martins' })
    await user.click(within(comment).getByRole('button', { name: 'Editar' }))
    const campo = within(comment).getByLabelText('Editar seu comentário')
    await user.clear(campo)
    await user.type(campo, 'Texto novo')
    await user.click(within(comment).getByRole('button', { name: 'Salvar' }))

    expect(api.comments.update).toHaveBeenCalledWith('c1', 'Texto novo')
    expect(await screen.findByText('Texto novo')).toBeInTheDocument()
    expect(screen.getByText(/editado/)).toBeInTheDocument()

    await user.click(within(comment).getByRole('button', { name: 'Excluir' }))
    expect(remove).toHaveBeenCalledWith('c1')
    expect(
      await screen.findByText('Seja a primeira pessoa a comentar sobre este evento.'),
    ).toBeInTheDocument()
  })

  it('não mostra editar e excluir em comentários de outras pessoas', async () => {
    renderEvent()
    await screen.findByRole('article', { name: 'Comentário de Rafael Martins' })
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
  })
})
