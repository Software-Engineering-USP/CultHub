import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentUser } from '@/data/user'
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
  cidade: 'São Paulo',
  estado: 'SP',
  bairro: 'Vila Mariana',
  preferencias: ['music', 'art'],
  iniciais: 'LC',
}

describe('Account', () => {
  beforeEach(() => {
    vi.spyOn(api.agenda, 'attendances').mockResolvedValue(apiPage([]))
    vi.spyOn(api.agenda, 'calendar').mockResolvedValue(apiPage([]))
    vi.spyOn(api.comments, 'mine').mockResolvedValue(commentPage([apiMyComment()]))
    vi.spyOn(api.localities, 'states').mockResolvedValue([
      { sigla: 'RJ', nome: 'Rio de Janeiro' },
      { sigla: 'SP', nome: 'São Paulo' },
    ])
    vi.spyOn(api.localities, 'cities').mockImplementation(async (state) =>
      state === 'SP' ? ['Campinas', 'São Paulo'] : ['Niterói', 'Rio de Janeiro'],
    )
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

  it('Salvar alterações envia nome e bairro, sem reenviar a localidade que não mudou', async () => {
    const update = vi.spyOn(api.profile, 'update').mockResolvedValue(profile)
    const { user } = renderWithRouter(<Account />)

    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly')
    const bairro = screen.getByLabelText('Bairro')
    await user.clear(bairro)
    await user.type(bairro, 'Pinheiros')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(update).toHaveBeenCalledWith({ name: 'Lívia Costa', district: 'Pinheiros' })
  })

  it('mostra a cidade e a UF na lateral', () => {
    renderWithRouter(<Account />)
    const aside = within(screen.getByRole('complementary', { name: 'Perfil e navegação da conta' }))
    expect(aside.getByText('São Paulo, SP')).toBeInTheDocument()
  })

  it('trocar o estado limpa a cidade e a busca sugere os municípios da nova UF', async () => {
    const update = vi
      .spyOn(api.profile, 'update')
      .mockResolvedValue({ ...profile, cidade: 'Niterói', estado: 'RJ' })
    const { user } = renderWithRouter(<Account />)
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    await waitFor(() => expect(cidade).toHaveValue('São Paulo'))

    await user.selectOptions(screen.getByLabelText('Estado'), 'RJ')
    expect(cidade).toHaveValue('')
    expect(api.localities.cities).toHaveBeenCalledWith('RJ')

    await user.type(cidade, 'nite')
    await user.click(await screen.findByRole('option', { name: 'Niterói' }))
    expect(cidade).toHaveValue('Niterói')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(update).toHaveBeenCalledWith({
      name: 'Lívia Costa',
      district: 'Vila Mariana',
      locality: { city: 'Niterói', state: 'RJ' },
    })
    const aside = within(screen.getByRole('complementary', { name: 'Perfil e navegação da conta' }))
    expect(await aside.findByText('Niterói, RJ')).toBeInTheDocument()
  })

  it('cidade escrita sem acento vira o nome oficial ao sair do campo', async () => {
    const { user } = renderWithRouter(<Account />)
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    await user.clear(cidade)
    await user.type(cidade, 'sao paulo')
    await user.tab()

    expect(cidade).toHaveValue('São Paulo')
  })

  it('cidade fora da lista da UF não é enviada', async () => {
    const update = vi.spyOn(api.profile, 'update').mockResolvedValue(profile)
    const { user } = renderWithRouter(<Account />)
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    await user.clear(cidade)
    await user.type(cidade, 'Sampa')
    await user.tab()

    expect(await screen.findByText(/Não há um município com esse nome em SP/)).toBeInTheDocument()
    expect(cidade).toHaveAttribute('aria-invalid', 'true')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(update).not.toHaveBeenCalled()
  })

  it('sem estado nem cidade, a cidade só é editável depois de escolher a UF', async () => {
    const { user } = renderWithRouter(<Account />, {
      authUser: { ...currentUser, city: '', state: '' },
    })
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    expect(cidade).toHaveAttribute('readonly')
    expect(screen.getByText('Escolha o estado para buscar a cidade.')).toBeInTheDocument()

    await screen.findByRole('option', { name: 'São Paulo (SP)' })
    await user.selectOptions(screen.getByLabelText('Estado'), 'SP')
    expect(cidade).not.toHaveAttribute('readonly')
  })

  it('perfil antigo com cidade sem estado pede o estado e mantém a cidade ao escolher', async () => {
    const { user } = renderWithRouter(<Account />, {
      authUser: { ...currentUser, city: 'Campinas', state: '' },
    })
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    expect(
      screen.getByText('Escolha o estado de Campinas para confirmar a cidade, ou apague o campo.'),
    ).toBeInTheDocument()

    await screen.findByRole('option', { name: 'São Paulo (SP)' })
    await user.selectOptions(screen.getByLabelText('Estado'), 'SP')
    expect(cidade).toHaveValue('Campinas')
  })

  it('perfil antigo com cidade sem estado consegue apagar a cidade', async () => {
    const update = vi.spyOn(api.profile, 'update').mockResolvedValue({ ...profile, cidade: '', estado: '' })
    const { user } = renderWithRouter(<Account />, {
      authUser: { ...currentUser, city: 'Moema', state: '' },
    })
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    expect(cidade).not.toHaveAttribute('readonly')

    await user.clear(cidade)
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(update).toHaveBeenCalledWith({
      name: 'Lívia Costa',
      district: 'Vila Mariana',
      locality: { city: '', state: '' },
    })
  })

  it('perfil antigo sem estado não envia outra cidade sem a UF', async () => {
    const update = vi.spyOn(api.profile, 'update').mockResolvedValue(profile)
    const { user } = renderWithRouter(<Account />, {
      authUser: { ...currentUser, city: 'Moema', state: '' },
    })
    const cidade = screen.getByRole('combobox', { name: 'Cidade' })
    await user.clear(cidade)
    await user.type(cidade, 'Campinas')
    await user.tab()

    expect(await screen.findByText('Escolha o estado da cidade.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(update).not.toHaveBeenCalled()
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
