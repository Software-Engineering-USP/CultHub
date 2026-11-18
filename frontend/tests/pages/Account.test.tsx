import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Account from '@/pages/Account'
import { api } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'
import { apiComment, apiMyComment, commentPage } from '@tests/fixtures/comments'
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
  beforeEach(() => {
    vi.spyOn(api.agenda, 'attendances').mockResolvedValue(apiPage([]))
    vi.spyOn(api.agenda, 'calendar').mockResolvedValue(apiPage([]))
    vi.spyOn(api.comments, 'mine').mockResolvedValue(commentPage([apiMyComment()]))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lista os comentários do usuário com link para o evento', async () => {
    renderWithRouter(<Account />)
    const section = within(screen.getByRole('region', { name: 'Meus comentários' }))
    expect(await section.findByText('Jazz ao vivo no Ibirapuera!')).toBeInTheDocument()
    expect(section.getByRole('link', { name: /São Paulo Jazz & Blues Festival/ })).toHaveAttribute(
      'href',
      '/eventos/sp-jazz-blues-festival',
    )
  })

  it('mostra o aviso quando o usuário ainda não comentou', async () => {
    vi.spyOn(api.comments, 'mine').mockResolvedValue(commentPage([]))
    renderWithRouter(<Account />)
    expect(await screen.findByText(/Você ainda não comentou em nenhum evento/)).toBeInTheDocument()
  })

  it('Excluir pede confirmação, chama a API e tira o comentário da lista', async () => {
    const remove = vi.spyOn(api.comments, 'remove').mockResolvedValue()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const { user } = renderWithRouter(<Account />)
    const excluir = await screen.findByRole('button', { name: 'Excluir' })

    await user.click(excluir)
    expect(remove).not.toHaveBeenCalled()

    await user.click(excluir)
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith('m1')
    await waitFor(() => expect(screen.queryByText('Jazz ao vivo no Ibirapuera!')).not.toBeInTheDocument())
  })

  it('Editar salva o novo texto', async () => {
    const update = vi
      .spyOn(api.comments, 'update')
      .mockResolvedValue(
        apiComment({ id: 'm1', texto: 'Mudei de ideia', editado_em: '2026-11-16T10:00:00Z' }),
      )
    const { user } = renderWithRouter(<Account />)

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    const campo = screen.getByLabelText('Editar seu comentário')
    await user.clear(campo)
    await user.type(campo, 'Mudei de ideia')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(update).toHaveBeenCalledWith('m1', 'Mudei de ideia')
    expect(await screen.findByText('Mudei de ideia')).toBeInTheDocument()
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
    expect(within(menu).getByRole('link', { name: 'Minha agenda' })).toHaveAttribute('href', '#agenda')
    expect(within(menu).getByRole('link', { name: 'Presenças' })).toHaveAttribute('href', '#presencas')
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
