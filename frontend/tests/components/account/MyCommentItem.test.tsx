import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MyCommentItem from '@/components/account/MyCommentItem'
import { paths } from '@/lib/paths'
import { ApiError } from '@/services/api'
import type { ApiMyComment } from '@/services/api'
import { toMyComment } from '@/services/comments'
import { apiMyComment } from '@tests/fixtures/comments'
import { renderWithRouter } from '@tests/render'

function renderItem(overrides: Partial<ApiMyComment> = {}) {
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  const onRemove = vi.fn().mockResolvedValue(undefined)
  const rendered = renderWithRouter(
    <MyCommentItem comment={toMyComment(apiMyComment(overrides))} onUpdate={onUpdate} onRemove={onRemove} />,
  )
  return { ...rendered, onUpdate, onRemove }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MyCommentItem', () => {
  it('mostra o link para o evento, o tipo e o texto', () => {
    renderItem()
    expect(screen.getByRole('link', { name: /São Paulo Jazz & Blues Festival/ })).toHaveAttribute(
      'href',
      paths.event('sp-jazz-blues-festival'),
    )
    expect(screen.getByText(/^Comentário/)).toBeInTheDocument()
    expect(screen.getByText('Jazz ao vivo no Ibirapuera!')).toBeInTheDocument()
    expect(screen.queryByText(/editado/)).not.toBeInTheDocument()
  })

  it('identifica respostas e comentários editados', () => {
    renderItem({ nivel: 1, resposta_a: 'c1', editado_em: '2026-11-16T10:00:00Z' })
    expect(screen.getByText(/^Resposta/)).toHaveTextContent('editado')
  })

  it('Cancelar sai da edição sem salvar', async () => {
    const { user, onUpdate } = renderItem()
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Editar seu comentário')).toHaveValue('Jazz ao vivo no Ibirapuera!')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Editar seu comentário')).not.toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('mantém a edição aberta e mostra o erro quando salvar falha', async () => {
    const { user, onUpdate } = renderItem()
    onUpdate.mockRejectedValue(new ApiError('Comentário removido não pode ser editado.', 409))

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Comentário removido não pode ser editado.')
    expect(screen.getByLabelText('Editar seu comentário')).toBeInTheDocument()
  })

  it('não exclui quando a confirmação é recusada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, onRemove } = renderItem()
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('desabilita Excluir enquanto exclui', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onRemove } = renderItem()
    onRemove.mockReturnValue(new Promise<void>(() => {}))

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onRemove).toHaveBeenCalledWith('m1')
    expect(screen.getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
  })

  it('mostra a mensagem da API quando a exclusão falha', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onRemove } = renderItem()
    onRemove.mockRejectedValue(new ApiError('Muitas requisições.', 429))

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas requisições.')
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('mostra uma mensagem genérica quando a exclusão falha sem ApiError', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onRemove } = renderItem()
    onRemove.mockRejectedValue(new Error('rede'))

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível excluir o comentário.')
  })
})
