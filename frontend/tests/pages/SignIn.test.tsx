import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SignIn from '@/pages/SignIn'
import { api } from '@/services/api'
import type { ProfileResponse } from '@/services/api'
import { AuthTestProvider } from '@tests/auth'
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

  it('exibe o link para recuperar a senha', () => {
    renderWithRouter(<SignIn />, { authUser: null })
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    )
  })

  it('confirma que a senha foi alterada ao voltar para o login', () => {
    render(
      <AuthTestProvider initialUser={null}>
        <MemoryRouter initialEntries={[{ pathname: '/entrar', state: { passwordReset: true } }]}>
          <Routes>
            <Route path="/entrar" element={<SignIn />} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Senha alterada. Entre com sua nova senha.')
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

  function renderFrom(from: unknown) {
    return render(
      <AuthTestProvider initialUser={null}>
        <MemoryRouter initialEntries={[{ pathname: '/entrar', state: { from } }]}>
          <Routes>
            <Route path="/entrar" element={<SignIn />} />
            <Route path="/usuarios/:id" element={<h1>Perfil de destino</h1>} />
            <Route path="/conta" element={<h1>Minha conta</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>,
    )
  }

  async function logIn() {
    const user = userEvent.setup()
    const login = screen.getByRole('form', { name: 'Entrar' })
    await user.type(within(login).getByLabelText('E-mail'), 'voce@exemplo.com')
    await user.type(within(login).getByLabelText('Senha'), 'segredo123')
    await user.click(within(login).getByRole('button', { name: 'Entrar' }))
  }

  it('depois de entrar, volta para a página que pediu login', async () => {
    vi.spyOn(api.auth, 'signIn').mockResolvedValue(profile)
    renderFrom('/usuarios/caio-prado')
    await logIn()
    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil de destino' })).toBeInTheDocument()
  })

  it('ignora destino externo e vai para a Minha conta', async () => {
    vi.spyOn(api.auth, 'signIn').mockResolvedValue(profile)
    renderFrom('//exemplo.com/phishing')
    await logIn()
    expect(await screen.findByRole('heading', { level: 1, name: 'Minha conta' })).toBeInTheDocument()
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
