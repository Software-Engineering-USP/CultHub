import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CommentsSection from '@/components/events/CommentsSection'
import { paths } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import { apiComment, commentPage } from '@tests/fixtures/comments'
import { renderWithRouter } from '@tests/render'

function renderSection(authUser?: null) {
  return renderWithRouter(<CommentsSection eventId="sp-jazz-blues-festival" />, { authUser })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CommentsSection', () => {
  it('mostra "Carregando" enquanto busca os comentários', () => {
    vi.spyOn(api.comments, 'list').mockReturnValue(new Promise(() => {}))
    renderSection()
    expect(screen.getByText(/^Carregando •/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it.each([
    [0, 'Nenhum comentário ainda'],
    [1, '1 comentário'],
    [12, '12 comentários'],
  ])('com %i comentário(s) mostra "%s"', async (count, label) => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(
      commentPage(count ? [apiComment()] : [], count > 1 ? 'next' : null, count),
    )
    renderSection()
    expect(await screen.findByText(new RegExp(`^${label} •`))).toBeInTheDocument()
  })

  it('mostra o erro quando a lista falha', async () => {
    vi.spyOn(api.comments, 'list').mockRejectedValue(new Error('rede'))
    renderSection()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os comentários.')
  })

  it('visitante vê o link para entrar', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([]))
    renderSection(null)
    expect(await screen.findByRole('link', { name: 'Entre' })).toHaveAttribute('href', paths.signIn)
  })

  it('Carregar mais busca a próxima página', async () => {
    const list = vi
      .spyOn(api.comments, 'list')
      .mockResolvedValueOnce(commentPage([apiComment()], 'next', 2))
      .mockResolvedValueOnce(
        commentPage(
          [apiComment({ id: 'c2', autor: { id: 'ana', nome: 'Ana Souza', iniciais: 'AS' } })],
          null,
          2,
        ),
      )
    const { user } = renderSection()

    await user.click(await screen.findByRole('button', { name: 'Carregar mais comentários' }))

    expect(list).toHaveBeenLastCalledWith('sp-jazz-blues-festival', 2)
    expect(await screen.findByRole('article', { name: 'Comentário de Ana Souza' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carregar mais comentários' })).not.toBeInTheDocument()
  })

  it('desabilita Carregar mais enquanto busca', async () => {
    vi.spyOn(api.comments, 'list')
      .mockResolvedValueOnce(commentPage([apiComment()], 'next', 2))
      .mockReturnValueOnce(new Promise(() => {}))
    const { user } = renderSection()

    await user.click(await screen.findByRole('button', { name: 'Carregar mais comentários' }))
    expect(screen.getByRole('button', { name: 'Carregando…' })).toBeDisabled()
  })

  it('mantém os comentários e mostra o erro quando carregar mais falha', async () => {
    vi.spyOn(api.comments, 'list')
      .mockResolvedValueOnce(commentPage([apiComment()], 'next', 2))
      .mockRejectedValueOnce(new ApiError('Muitas requisições.', 429))
    const { user } = renderSection()

    await user.click(await screen.findByRole('button', { name: 'Carregar mais comentários' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas requisições.')
    expect(screen.getByRole('article', { name: 'Comentário de Rafael Martins' })).toBeInTheDocument()
  })

  it('mostra uma mensagem genérica quando publicar falha sem ApiError', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([]))
    vi.spyOn(api.comments, 'create').mockRejectedValue(new Error('rede'))
    const { user } = renderSection()

    await user.type(await screen.findByLabelText('Seu comentário sobre o evento'), 'Oi')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível publicar o comentário. Tente novamente.',
    )
    expect(screen.getByRole('button', { name: 'Publicar comentário' })).toBeEnabled()
  })

  it('não publica texto só com espaços', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([]))
    const create = vi.spyOn(api.comments, 'create')
    const { user } = renderSection()

    const field = await screen.findByLabelText('Seu comentário sobre o evento')
    await user.type(field, '   ')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(create).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva algo antes de enviar.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('desabilita o formulário enquanto publica', async () => {
    vi.spyOn(api.comments, 'list').mockResolvedValue(commentPage([]))
    vi.spyOn(api.comments, 'create').mockReturnValue(new Promise(() => {}))
    const { user } = renderSection()

    await user.type(await screen.findByLabelText('Seu comentário sobre o evento'), 'Oi')
    await user.click(screen.getByRole('button', { name: 'Publicar comentário' }))

    expect(screen.getByRole('button', { name: 'Publicando…' })).toBeDisabled()
    expect(screen.getByLabelText('Seu comentário sobre o evento')).toBeDisabled()
  })
})
