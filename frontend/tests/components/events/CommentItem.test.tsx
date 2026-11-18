import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CommentItem from '@/components/events/CommentItem'
import { ApiError } from '@/services/api'
import type { ApiComment } from '@/services/api'
import { toEventComment } from '@/services/comments'
import { apiComment } from '@tests/fixtures/comments'

function renderItem(overrides: Partial<ApiComment> = {}, canReply = true) {
  const actions = {
    onReply: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
  }
  render(<CommentItem comment={toEventComment(apiComment(overrides))} canReply={canReply} {...actions} />)
  return { user: userEvent.setup(), ...actions }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CommentItem', () => {
  it('mostra autor, data e texto', () => {
    renderItem()
    const comment = screen.getByRole('article', { name: 'Comentário de Rafael Martins' })
    expect(within(comment).getByText('Rafael Martins')).toBeInTheDocument()
    expect(within(comment).getByText('Gostei da proposta!')).toBeInTheDocument()
    expect(comment.querySelector('time')).toHaveAttribute('dateTime', '2026-11-15T20:00:00Z')
    expect(comment).not.toHaveTextContent('editado')
  })

  it('indica quando o comentário foi editado', () => {
    renderItem({ editado_em: '2026-11-16T10:00:00Z' })
    expect(screen.getByText(/editado/)).toBeInTheDocument()
  })

  it('mostra o comentário removido sem autor nem ações, mantendo as respostas', () => {
    renderItem({
      autor: null,
      texto: null,
      removido: true,
      respostas: [apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1', texto: 'Resposta que ficou' })],
    })

    const removed = screen.getByRole('article', { name: 'Comentário removido' })
    expect(within(removed).getByText('Este comentário foi removido.')).toBeInTheDocument()
    expect(within(removed).getByText('Resposta que ficou')).toBeInTheDocument()
    // Só a resposta (de nível 1) aparece, e ela não pode ser respondida.
    expect(screen.queryByRole('button', { name: /Responder/ })).not.toBeInTheDocument()
  })

  it('só oferece Responder em comentários de primeiro nível', () => {
    renderItem({ respostas: [apiComment({ id: 'r1', nivel: 1, resposta_a: 'c1' })] })
    expect(screen.getAllByRole('button', { name: /Responder/ })).toHaveLength(1)
  })

  it('não oferece Responder para quem não está logado', () => {
    renderItem({}, false)
    expect(screen.queryByRole('button', { name: /Responder/ })).not.toBeInTheDocument()
  })

  it('Cancelar fecha o campo de resposta sem enviar', async () => {
    const { user, onReply } = renderItem()
    await user.click(screen.getByRole('button', { name: 'Responder a Rafael Martins' }))
    expect(screen.getByLabelText('Sua resposta a Rafael Martins')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Sua resposta a Rafael Martins')).not.toBeInTheDocument()
    expect(onReply).not.toHaveBeenCalled()
  })

  it('Cancelar a edição volta a mostrar o texto', async () => {
    const { user, onUpdate } = renderItem({ meu: true })
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Editar seu comentário')).toHaveValue('Gostei da proposta!')
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Editar seu comentário')).not.toBeInTheDocument()
    expect(screen.getByText('Gostei da proposta!')).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('não exclui quando a confirmação é recusada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, onRemove } = renderItem({ meu: true })
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('desabilita Excluir enquanto exclui', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onRemove } = renderItem({ meu: true })
    onRemove.mockReturnValue(new Promise<void>(() => {}))

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onRemove).toHaveBeenCalledWith('c1')
    expect(screen.getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
  })

  it('mostra a mensagem da API quando a exclusão falha', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onRemove } = renderItem({ meu: true })
    onRemove.mockRejectedValue(new ApiError('Você não pode excluir este comentário.', 403))

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não pode excluir este comentário.')
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('mostra uma mensagem genérica quando a exclusão falha sem ApiError', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onRemove } = renderItem({ meu: true })
    onRemove.mockRejectedValue(new Error('rede'))

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível excluir o comentário.')
  })
})
