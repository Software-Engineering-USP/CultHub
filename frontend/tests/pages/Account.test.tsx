import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import Account from '@/pages/Account'
import { api } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import { renderWithRouter } from '@tests/render'

const profile: ProfileResponse = {
  id: 'livia-costa',
  nome: 'Lívia Costa',
  email: 'livia.costa@exemplo.com',
  cidade: 'São Paulo, SP',
  bairro: 'Vila Mariana',
  preferencias: ['music', 'art'],
  iniciais: 'LC',
}

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

  it('Salvar alterações envia nome, cidade e bairro (o e-mail não é editável)', async () => {
    const update = vi.spyOn(api.profile, 'update').mockResolvedValue(profile)
    const { user } = renderWithRouter(<Account />)

    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly')
    const bairro = screen.getByLabelText('Bairro')
    await user.clear(bairro)
    await user.type(bairro, 'Pinheiros')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(update).toHaveBeenCalledWith({ name: 'Lívia Costa', city: 'São Paulo, SP', district: 'Pinheiros' })
  })

  it('marcar uma preferência envia a lista atualizada', async () => {
    const updatePreferences = vi.spyOn(api.profile, 'updatePreferences').mockResolvedValue(profile)
    const { user } = renderWithRouter(<Account />)

    await user.click(screen.getByLabelText('Teatro'))

    expect(updatePreferences).toHaveBeenCalledWith(['music', 'theater', 'art'])
  })

  it('o menu lateral marca a seção atual', () => {
    renderWithRouter(<Account />)
    const menu = screen.getByRole('navigation', { name: 'Seções da conta' })
    expect(within(menu).getByRole('link', { name: 'Dados pessoais' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(within(menu).getByRole('link', { name: 'Eventos salvos' })).not.toHaveAttribute('aria-current')
  })
})
