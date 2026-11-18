import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CommentEditor from '@/components/events/CommentEditor'
import { ApiError } from '@/services/api'

function renderEditor(onSubmit = vi.fn().mockResolvedValue(undefined), initialText = '') {
  const onCancel = vi.fn()
  render(
    <CommentEditor
      label="Editar seu comentário"
      submitLabel="Salvar"
      initialText={initialText}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  )
  return {
    user: userEvent.setup(),
    onSubmit,
    onCancel,
    field: screen.getByLabelText('Editar seu comentário'),
  }
}

describe('CommentEditor', () => {
  it('começa com o texto inicial e envia o texto sem espaços nas pontas', async () => {
    const { user, onSubmit, field } = renderEditor(undefined, 'Texto antigo')
    expect(field).toHaveValue('Texto antigo')

    await user.clear(field)
    await user.type(field, '  Texto novo  ')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSubmit).toHaveBeenCalledWith('Texto novo')
  })

  it('não envia texto só com espaços', async () => {
    const { user, onSubmit, field } = renderEditor()
    await user.type(field, '   ')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva algo antes de enviar.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('desabilita o formulário enquanto envia', async () => {
    const { user, field } = renderEditor(vi.fn(() => new Promise<void>(() => {})))
    await user.type(field, 'Oi')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(field).toBeDisabled()
  })

  it('mostra a mensagem da API e libera o formulário quando falha', async () => {
    const { user, field } = renderEditor(vi.fn().mockRejectedValue(new ApiError('texto: Muito longo.', 400)))
    await user.type(field, 'Oi')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('texto: Muito longo.')
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
    expect(field).toHaveValue('Oi')
  })

  it('mostra uma mensagem genérica para erros inesperados', async () => {
    const { user, field } = renderEditor(vi.fn().mockRejectedValue(new Error('rede')))
    await user.type(field, 'Oi')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar. Tente novamente.')
  })

  it('Cancelar chama onCancel', async () => {
    const { user, onCancel } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
