import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, AUTHENTICATION_FAILURE_EVENT } from '@/services/api'

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

  it('usa as rotas de salvar, presença e lista paginada da agenda', async () => {
    await api.events.save('evento/42')
    await api.events.unsave('evento/42')
    await api.events.attend('evento/42')
    await api.events.unattend('evento/42')
    await api.agenda.savedEvents()
    await api.agenda.savedEvents(2)
    await api.agenda.attendances('futuras')
    await api.agenda.attendances('passadas', 3)
    await api.agenda.calendar('2026-11-01', '2026-11-30')
    await api.agenda.calendar('2026-11-01', '2026-11-30', 2)
    await api.agenda.attendees('evento/42')
    await api.agenda.attendees('evento/42', 2)

    expect(fetchMock.mock.calls.map(([url, options]) => [url, (options as RequestInit).method])).toEqual([
      ['/api/eventos/evento%2F42/salvar/', 'POST'],
      ['/api/eventos/evento%2F42/salvar/', 'DELETE'],
      ['/api/eventos/evento%2F42/presenca/', 'POST'],
      ['/api/eventos/evento%2F42/presenca/', 'DELETE'],
      ['/api/eu/salvos/', 'GET'],
      ['/api/eu/salvos/?page=2', 'GET'],
      ['/api/eu/presencas/?quando=futuras', 'GET'],
      ['/api/eu/presencas/?quando=passadas&page=3', 'GET'],
      ['/api/eu/agenda/?de=2026-11-01&ate=2026-11-30', 'GET'],
      ['/api/eu/agenda/?de=2026-11-01&ate=2026-11-30&page=2', 'GET'],
      ['/api/eventos/evento%2F42/presencas/', 'GET'],
      ['/api/eventos/evento%2F42/presencas/?page=2', 'GET'],
    ])
  })

  it('atualiza as notificações após salvar ou confirmar presença', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')

    await api.events.save('evento-salvo')
    await api.events.attend('evento-confirmado')

    const events = dispatchEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'culthub:notifications-updated') as CustomEvent[]
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.detail)).toEqual([
      { eventId: 'evento-salvo' },
      { eventId: 'evento-confirmado' },
    ])
  })

  it('consulta notificações e marca uma ou todas como lidas', async () => {
    await api.notifications.list()
    await api.notifications.markRead('notificacao/42')
    await api.notifications.markAllRead()

    expect(fetchMock.mock.calls.map(([url, options]) => [url, (options as RequestInit).method])).toEqual([
      ['/api/eu/notificacoes/', 'GET'],
      ['/api/notificacoes/notificacao%2F42/ler/', 'PATCH'],
      ['/api/eu/notificacoes/ler-todas/', 'POST'],
    ])
  })

  it('não atualiza as notificações quando salvar o evento falha', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Falha.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(api.events.save('evento')).rejects.toThrow('Falha.')

    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('usa as rotas de comentários, respostas e da lista do usuário', async () => {
    await api.comments.list('evento/42')
    await api.comments.list('evento/42', 2)
    await api.comments.create('evento/42', 'Oi')
    await api.comments.reply('c/1', 'Também')
    await api.comments.update('c/1', 'Editado')
    await api.comments.mine()
    await api.comments.mine(3)

    expect(fetchMock.mock.calls.map(([url, options]) => [url, (options as RequestInit).method])).toEqual([
      ['/api/eventos/evento%2F42/comentarios/', 'GET'],
      ['/api/eventos/evento%2F42/comentarios/?page=2', 'GET'],
      ['/api/eventos/evento%2F42/comentarios/', 'POST'],
      ['/api/comentarios/c%2F1/respostas/', 'POST'],
      ['/api/comentarios/c%2F1/', 'PATCH'],
      ['/api/eu/comentarios/', 'GET'],
      ['/api/eu/comentarios/?page=3', 'GET'],
    ])
    expect(fetchMock.mock.calls.slice(2, 5).map(([, options]) => JSON.parse(options.body as string))).toEqual(
      [{ texto: 'Oi' }, { texto: 'Também' }, { texto: 'Editado' }],
    )
  })

  it('remover comentário aceita a resposta 204 sem corpo', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(api.comments.remove('c1')).resolves.toBeUndefined()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/comentarios/c1/')
    expect(options.method).toBe('DELETE')
    expect(options.body).toBeUndefined()
  })

  it('mostra a mensagem "detail" do backend sem o nome do campo', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Muitas requisições.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(api.comments.create('evento', 'Oi')).rejects.toMatchObject({
      message: 'Muitas requisições.',
      status: 429,
    })
  })

  it.each([401, 403])('notifica o AuthContext de uma resposta HTTP %s em rota protegida', async (status) => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Sessão inválida.' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(api.comments.create('evento', 'Oi')).rejects.toMatchObject({ status })

    expect(dispatchEvent.mock.calls.some(([event]) => event.type === AUTHENTICATION_FAILURE_EVENT)).toBe(true)
  })

  it('não emite sinal de expiração na própria consulta que verifica a sessão', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Sessão inválida.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(api.auth.currentUser()).rejects.toMatchObject({ status: 403 })

    expect(dispatchEvent.mock.calls.some(([event]) => event.type === AUTHENTICATION_FAILURE_EVENT)).toBe(
      false,
    )
  })

  it('emite sinal de expiração para PATCH do perfil em /eu/', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Sessão expirada.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(
      api.profile.update({ name: 'Lívia', city: 'São Paulo', district: 'Centro' }),
    ).rejects.toMatchObject({ status: 403 })

    expect(dispatchEvent.mock.calls.some(([event]) => event.type === AUTHENTICATION_FAILURE_EVENT)).toBe(true)
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

  it('envia os dados de recuperação e redefinição de senha ao backend', async () => {
    await api.auth.requestPasswordReset('voce@exemplo.com')
    await api.auth.resetPassword({
      uid: 'user-id',
      token: 'reset-token',
      password: 'nova-senha-1234',
    })

    expect(fetchMock.mock.calls.map(([url, options]) => [url, (options as RequestInit).method])).toEqual([
      ['/api/auth/recuperar-senha/', 'POST'],
      ['/api/auth/redefinir-senha/', 'POST'],
    ])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      email: 'voce@exemplo.com',
    })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      uid: 'user-id',
      token: 'reset-token',
      senha: 'nova-senha-1234',
    })
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
