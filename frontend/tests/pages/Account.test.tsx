import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import Account from '@/pages/Account'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

describe('Account', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Excluir chama a API com o id do comentário', async () => {
    const remove = vi.spyOn(api.comments, 'remove').mockResolvedValue()
    const { user } = renderWithRouter(<Account />)
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(remove).toHaveBeenCalledWith('c1')
  })

  it('Editar registra a ação com o id do comentário', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderWithRouter(<Account />)
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(log).toHaveBeenCalledWith('Abrir edição do comentário', { commentId: 'c1' })
  })
})
