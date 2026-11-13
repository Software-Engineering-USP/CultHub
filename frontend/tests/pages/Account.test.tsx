import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as demo from '@/lib/demo'
import Account from '@/pages/Account'
import { api } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import { apiEvent } from '@tests/fixtures/catalog'
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

  it('salvar preferências envia a lista atualizada', async () => {
    const updatePreferences = vi.spyOn(api.profile, 'updatePreferences').mockResolvedValue(profile)
    const { user } = renderWithRouter(<Account />)

    await user.click(screen.getByLabelText('Teatro'))
    await user.click(screen.getByRole('button', { name: 'Salvar preferências' }))

    expect(updatePreferences).toHaveBeenCalledWith(['music', 'art', 'theater'])
  })

  it('o menu lateral marca a seção atual', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0)
    vi.spyOn(api.agenda, 'savedEvents').mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    renderWithRouter(<Account />)
    await waitFor(() => expect(screen.getByText('0 experiências salvas')).toBeInTheDocument())
    const menu = screen.getByRole('navigation', { name: 'Seções da conta' })
    expect(within(menu).getByRole('link', { name: 'Dados pessoais' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(within(menu).getByRole('link', { name: 'Eventos salvos' })).not.toHaveAttribute('aria-current')
  })

  it('carrega eventos salvos da conta e permite abrir seus detalhes', async () => {
    const savedEvents = vi.spyOn(api.agenda, 'savedEvents').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [apiEvent({ id: 'evento-salvo', titulo: 'Show salvo' })],
    })
    renderWithRouter(<Account />)

    expect(await screen.findByRole('link', { name: 'Conhecer Show salvo' })).toBeInTheDocument()
    expect(savedEvents).toHaveBeenCalledWith(1)
  })
})
