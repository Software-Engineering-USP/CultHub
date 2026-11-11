import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'

const profile = {
  id: 'user-1',
  nome: 'Lívia Costa',
  email: 'livia.costa@exemplo.com',
  cidade: 'São Paulo, SP',
  bairro: 'Vila Mariana',
  preferencias: ['music', 'art'],
  iniciais: 'LC',
}

describe('api', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let info: MockInstance<typeof console.info>

  beforeEach(() => {
    document.cookie = 'csrftoken=test-token; path=/'
    fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.cookie = 'csrftoken=; Max-Age=0; path=/'
  })

  it('envia a atualização do perfil com sessão e token CSRF', async () => {
    await api.profile.update({ name: 'Lívia Costa', city: 'São Paulo, SP', district: 'Vila Mariana' })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/eu/')
    expect(options.method).toBe('PATCH')
    expect(options.credentials).toBe('same-origin')
    expect(options.headers).toMatchObject({ 'X-CSRFToken': 'test-token' })
    expect(JSON.parse(options.body as string)).toEqual({
      nome: 'Lívia Costa',
      cidade: 'São Paulo, SP',
      bairro: 'Vila Mariana',
    })
  })

  it('envia e-mail e senha ao backend sem registrá-los no console', async () => {
    await api.auth.signIn({ email: 'voce@exemplo.com', password: 'segredo123', remember: true })
    await api.auth.signUp({
      name: 'Você',
      email: 'voce@exemplo.com',
      password: 'segredo123',
      acceptedTerms: true,
    })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/entrar/', '/api/auth/cadastro/'])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      email: 'voce@exemplo.com',
      senha: 'segredo123',
      lembrar: true,
    })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      nome: 'Você',
      email: 'voce@exemplo.com',
      senha: 'segredo123',
      aceite_termos: true,
    })
    expect(info).not.toHaveBeenCalled()
  })

  it('transforma erros de validação do backend em mensagens legíveis', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify({ email: ['Já existe uma conta com este e-mail.'] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      api.auth.signUp({
        name: 'Você',
        email: 'voce@exemplo.com',
        password: 'segredo123',
        acceptedTerms: true,
      }),
    ).rejects.toThrow('email: Já existe uma conta com este e-mail.')
  })
})
