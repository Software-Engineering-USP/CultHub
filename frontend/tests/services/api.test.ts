import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'

describe('api (mock)', () => {
  let info: MockInstance<typeof console.info>

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    info.mockRestore()
  })

  it('mostra método, caminho e corpo no formato do backend', async () => {
    await api.profile.update({ name: 'Lívia Costa', city: 'São Paulo, SP', district: 'Vila Mariana' })

    expect(info).toHaveBeenCalledWith('[CultHub API mock] PATCH /api/eu/', {
      nome: 'Lívia Costa',
      cidade: 'São Paulo, SP',
      bairro: 'Vila Mariana',
    })
  })

  it('nunca mostra a senha', async () => {
    await api.auth.signIn({ email: 'voce@exemplo.com', password: 'segredo123', remember: true })
    await api.auth.signUp({
      name: 'Você',
      email: 'voce@exemplo.com',
      password: 'segredo123',
      acceptedTerms: true,
    })

    expect(info).toHaveBeenCalledWith('[CultHub API mock] POST /api/auth/entrar/', {
      email: 'voce@exemplo.com',
      senha: '***',
      lembrar: true,
    })
    expect(JSON.stringify(info.mock.calls)).not.toContain('segredo123')
  })

  it('codifica o texto da busca na URL', async () => {
    await api.events.search('jazz & blues')
    expect(info).toHaveBeenCalledWith('[CultHub API mock] GET /api/eventos/?busca=jazz%20%26%20blues', '')
  })
})
