import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SignIn from '@/pages/SignIn'
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

describe('SignIn', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('informa que recuperação de senha ainda não está disponível', () => {
    renderWithRouter(<SignIn />, { authUser: null })
    expect(screen.getByText('Recuperação de senha indisponível')).toBeInTheDocument()
  })

  it('Entrar envia e-mail, senha e "lembrar de mim"', async () => {
    const signIn = vi.spyOn(api.auth, 'signIn').mockResolvedValue(profile)
    const { user } = renderWithRouter(<SignIn />, { authUser: null })
    const login = screen.getByRole('form', { name: 'Entrar' })

    await user.type(within(login).getByLabelText('E-mail'), 'voce@exemplo.com')
    await user.type(within(login).getByLabelText('Senha'), 'segredo123')
    await user.click(within(login).getByLabelText('Lembrar de mim'))
    await user.click(within(login).getByRole('button', { name: 'Entrar' }))

    expect(signIn).toHaveBeenCalledWith({ email: 'voce@exemplo.com', password: 'segredo123', remember: true })
  })

  it('Criar conta envia nome, e-mail, senha e o aceite dos termos', async () => {
    const signUp = vi.spyOn(api.auth, 'signUp').mockResolvedValue(profile)
    const { user } = renderWithRouter(<SignIn />, { authUser: null })
    const cadastro = screen.getByRole('form', { name: 'Criar conta' })

    await user.type(within(cadastro).getByLabelText('Nome'), 'Você')
    await user.type(within(cadastro).getByLabelText('E-mail'), 'voce@exemplo.com')
    await user.type(within(cadastro).getByLabelText('Senha'), 'segredo123')
    await user.click(within(cadastro).getByLabelText(/Aceito os termos/))
    await user.click(within(cadastro).getByRole('button', { name: 'Criar conta' }))

    expect(signUp).toHaveBeenCalledWith({
      name: 'Você',
      email: 'voce@exemplo.com',
      password: 'segredo123',
      acceptedTerms: true,
    })
  })

  it('não cria a conta sem aceitar os termos', async () => {
    const signUp = vi.spyOn(api.auth, 'signUp').mockResolvedValue(profile)
    const { user } = renderWithRouter(<SignIn />, { authUser: null })
    const cadastro = screen.getByRole('form', { name: 'Criar conta' })

    await user.type(within(cadastro).getByLabelText('Nome'), 'Você')
    await user.type(within(cadastro).getByLabelText('E-mail'), 'voce@exemplo.com')
    await user.type(within(cadastro).getByLabelText('Senha'), 'segredo123')
    await user.click(within(cadastro).getByRole('button', { name: 'Criar conta' }))

    expect(signUp).not.toHaveBeenCalled()
  })
})
