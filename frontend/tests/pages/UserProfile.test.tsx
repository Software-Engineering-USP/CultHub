import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { currentUser } from '@/data/user'
import { paths, routes } from '@/lib/paths'
import UserProfile from '@/pages/UserProfile'
import { api, ApiError } from '@/services/api'
import type { ApiPublicProfile } from '@/services/api'
import type { User } from '@/types'
import { AuthTestProvider } from '@tests/auth'
import { renderWithRouter } from '@tests/render'

function FromState() {
  const state = useLocation().state as { from?: string } | null
  return <p data-testid="from">{state?.from}</p>
}

function GoBack() {
  const navigate = useNavigate()
  return <button onClick={() => void navigate(-1)}>voltar</button>
}

function publicProfile(overrides: Partial<ApiPublicProfile> = {}): ApiPublicProfile {
  return {
    id: 'caio-prado',
    nome: 'Caio Prado',
    iniciais: 'CP',
    cidade: 'Campinas, SP',
    preferencias: ['theater', 'music'],
    membro_desde: '2026-10-28',
    ...overrides,
  }
}

function renderProfile(id = 'caio-prado', authUser?: User | null) {
  return renderWithRouter(
    <Routes>
      <Route path={routes.user} element={<UserProfile />} />
      <Route path={routes.signIn} element={<h1>Entrar</h1>} />
    </Routes>,
    { route: paths.user(id), authUser },
  )
}

describe('UserProfile', () => {
  let profile: MockInstance<typeof api.users.profile>

  beforeEach(() => {
    profile = vi.spyOn(api.users, 'profile').mockResolvedValue(publicProfile())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra nome, iniciais, cidade, preferências e desde quando é membro', async () => {
    renderProfile()

    expect(await screen.findByRole('heading', { level: 1, name: 'Caio Prado' })).toBeInTheDocument()
    expect(profile).toHaveBeenCalledWith('caio-prado')
    expect(screen.getByText('CP')).toBeInTheDocument()
    expect(screen.getByText('Campinas, SP')).toBeInTheDocument()
    expect(screen.getByText('outubro de 2026')).toHaveAttribute('dateTime', '2026-10-28')
    const preferences = screen.getByRole('region', { name: 'Preferências culturais' })
    // Na ordem da legenda do mapa, não na ordem em que vieram.
    expect(preferences).toHaveTextContent(/Música.*Teatro/)
    expect(document.title).toBe('Caio Prado | CultHub')
  })

  it('não mostra o aviso de perfil próprio para outra pessoa', async () => {
    renderProfile()
    await screen.findByRole('heading', { level: 1, name: 'Caio Prado' })
    expect(screen.queryByRole('link', { name: 'Editar na Minha conta' })).not.toBeInTheDocument()
  })

  it('trata cidade vazia e nenhuma preferência', async () => {
    profile.mockResolvedValue(publicProfile({ cidade: '', preferencias: [] }))
    renderProfile()

    expect(await screen.findByText('Cidade não informada')).toBeInTheDocument()
    expect(screen.getByText('Ainda não escolheu categorias preferidas.')).toBeInTheDocument()
  })

  it('no próprio perfil, aponta para a Minha conta', async () => {
    profile.mockResolvedValue(publicProfile({ id: currentUser.id, nome: currentUser.name }))
    renderProfile(currentUser.id)

    expect(await screen.findByRole('link', { name: 'Editar na Minha conta' })).toHaveAttribute(
      'href',
      paths.account,
    )
  })

  it('perfil inexistente mostra um aviso em vez de quebrar', async () => {
    profile.mockRejectedValue(new ApiError('Não encontrado.', 404))
    renderProfile('nao-existe')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Este perfil não existe ou a conta foi desativada.')).toBeInTheDocument()
    expect(document.title).toBe('Perfil não encontrado | CultHub')
  })

  it('outros erros mostram a mensagem da API', async () => {
    profile.mockRejectedValue(new ApiError('Servidor indisponível.', 500))
    renderProfile()

    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor indisponível.')
  })

  it('depois de uma falha, Tentar novamente busca o perfil de novo', async () => {
    profile.mockRejectedValueOnce(new ApiError('Servidor indisponível.', 500))
    const { user } = renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Caio Prado' })).toBeInTheDocument()
    expect(profile).toHaveBeenCalledTimes(2)
  })

  it('sem login, pede para entrar e não chama a API', async () => {
    const { user } = renderProfile('caio-prado', null)

    expect(screen.getByRole('heading', { level: 1, name: 'Entre para ver este perfil' })).toBeInTheDocument()
    expect(profile).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Entrar ou criar conta' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  })

  it('o link de entrar guarda o perfil para voltar depois do login', () => {
    render(
      <AuthTestProvider initialUser={null}>
        <MemoryRouter initialEntries={[`${paths.user('caio-prado')}?aba=x#topo`]}>
          <Routes>
            <Route path={routes.user} element={<UserProfile />} />
            <Route path={routes.signIn} element={<FromState />} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Entrar ou criar conta' }))
    expect(screen.getByTestId('from')).toHaveTextContent(`${paths.user('caio-prado')}?aba=x#topo`)
  })

  it('o link de entrar substitui o perfil no histórico, para o Voltar não repetir o perfil', async () => {
    const user = userEvent.setup()
    render(
      <AuthTestProvider initialUser={null}>
        <MemoryRouter initialEntries={[paths.event('jazz'), paths.user('caio-prado')]} initialIndex={1}>
          <Routes>
            <Route path={routes.user} element={<UserProfile />} />
            <Route path={routes.signIn} element={<GoBack />} />
            <Route path={routes.event} element={<h1>Página do evento</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>,
    )
    await user.click(screen.getByRole('link', { name: 'Entrar ou criar conta' }))
    await user.click(screen.getByRole('button', { name: 'voltar' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Página do evento' })).toBeInTheDocument()
  })

  it('sessão expirada (403) pede para entrar de novo em vez de mostrar erro', async () => {
    profile.mockRejectedValue(new ApiError('As credenciais de autenticação não foram fornecidas.', 403))
    renderProfile()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Entre para ver este perfil' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('enquanto carrega, a aba já mostra o título do perfil', () => {
    profile.mockReturnValue(new Promise(() => {}))
    renderProfile()
    expect(screen.getByText('Carregando perfil…')).toBeInTheDocument()
    expect(document.title).toBe('Perfil | CultHub')
  })

  it('sem histórico, o botão de voltar leva ao mapa', async () => {
    renderProfile()
    expect(await screen.findByRole('link', { name: 'Voltar ao mapa' })).toHaveAttribute('href', paths.home)
  })

  it('com histórico, Voltar volta para a página anterior', async () => {
    const user = userEvent.setup()
    render(
      <AuthTestProvider>
        <MemoryRouter initialEntries={[paths.event('jazz'), paths.user('caio-prado')]} initialIndex={1}>
          <Routes>
            <Route path={routes.user} element={<UserProfile />} />
            <Route path={routes.event} element={<h1>Página do evento</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthTestProvider>,
    )

    await user.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Página do evento' })).toBeInTheDocument()
  })
})
