import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NotificationsMenu from '@/components/layout/NotificationsMenu'
import { api, ApiError } from '@/services/api'
import type { ApiNotification, NotificationsResponse } from '@/services/api'
import { renderWithRouter } from '@tests/render'

function dateOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function notification(overrides: Partial<ApiNotification> = {}): ApiNotification {
  return {
    id: 'notificacao-1',
    evento_id: 'evento-1',
    titulo_evento: 'Show de hoje',
    data_inicio: dateOffset(0),
    hora_inicio: '19:30:00',
    local: 'Sala de shows',
    criada_em: new Date().toISOString(),
    lida_em: null,
    ...overrides,
  }
}

function notificationsResponse(resultados: ApiNotification[]): NotificationsResponse {
  return {
    nao_lidas: resultados.filter((item) => !item.lida_em).length,
    resultados,
  }
}

async function openMenu(user: ReturnType<typeof renderWithRouter>['user']) {
  await user.click(screen.getByRole('button', { name: /Notificações/ }))
  return screen.findByRole('dialog', { name: 'Notificações' })
}

describe('NotificationsMenu', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra hoje, amanhã e outras datas com ou sem horário', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 2)
    const futureLabel = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
    }).format(futureDate)
    vi.spyOn(api.notifications, 'list').mockResolvedValue(
      notificationsResponse([
        notification(),
        notification({
          id: 'notificacao-2',
          evento_id: 'evento-2',
          titulo_evento: 'Show de amanhã',
          data_inicio: dateOffset(1),
          local: 'Teatro',
        }),
        notification({
          id: 'notificacao-3',
          evento_id: 'evento-3',
          titulo_evento: 'Show futuro',
          data_inicio: dateOffset(2),
          hora_inicio: null,
          local: 'Auditório',
        }),
      ]),
    )
    const { user } = renderWithRouter(<NotificationsMenu />)

    const dialog = await openMenu(user)

    expect(within(dialog).getByText('Hoje às 19:30 · Sala de shows')).toBeInTheDocument()
    expect(within(dialog).getByText('Amanhã às 19:30 · Teatro')).toBeInTheDocument()
    expect(within(dialog).getByText(`${futureLabel} · Auditório`)).toBeInTheDocument()
    expect(within(dialog).getAllByText('Não lida')).toHaveLength(3)
  })

  it('mostra 9+ para mais de nove lembretes não lidos', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValue({
      nao_lidas: 12,
      resultados: [notification()],
    })
    renderWithRouter(<NotificationsMenu />)

    expect(await screen.findByText('9+')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificações, 12 não lidas' })).toBeInTheDocument()
  })

  it('marca um lembrete não lido como lido ao abrir o evento', async () => {
    const markRead = vi.spyOn(api.notifications, 'markRead').mockResolvedValue()
    vi.spyOn(api.notifications, 'list').mockResolvedValue(notificationsResponse([notification()]))
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    await user.click(within(dialog).getByRole('link', { name: /Show de hoje/ }))

    expect(markRead).toHaveBeenCalledWith('notificacao-1')
    expect(await screen.findByRole('button', { name: 'Notificações, 0 não lidas' })).toBeInTheDocument()
  })

  it('não envia outra marcação para uma notificação já lida', async () => {
    const markRead = vi.spyOn(api.notifications, 'markRead')
    vi.spyOn(api.notifications, 'list').mockResolvedValue(
      notificationsResponse([notification({ lida_em: new Date().toISOString() })]),
    )
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    await user.click(within(dialog).getByRole('link', { name: /Show de hoje/ }))

    expect(markRead).not.toHaveBeenCalled()
  })

  it('não abre automaticamente o menu para um lembrete já lido', async () => {
    const list = vi
      .spyOn(api.notifications, 'list')
      .mockResolvedValue(notificationsResponse([notification({ lida_em: new Date().toISOString() })]))
    renderWithRouter(<NotificationsMenu />)

    window.dispatchEvent(
      new CustomEvent('culthub:notifications-updated', { detail: { eventId: 'evento-1' } }),
    )

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog', { name: 'Notificações' })).not.toBeInTheDocument()
  })

  it('marca todas as notificações como lidas', async () => {
    const markAllRead = vi.spyOn(api.notifications, 'markAllRead').mockResolvedValue()
    vi.spyOn(api.notifications, 'list').mockResolvedValue(
      notificationsResponse([notification(), notification({ id: 'notificacao-2', evento_id: 'evento-2' })]),
    )
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    await user.click(within(dialog).getByRole('button', { name: 'Ler todas' }))

    expect(markAllRead).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Notificações, 0 não lidas' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Ler todas' })).not.toBeInTheDocument()
  })

  it('mostra o erro quando não consegue marcar todas como lidas', async () => {
    vi.spyOn(api.notifications, 'markAllRead').mockRejectedValue(new Error('Falha ao marcar.'))
    vi.spyOn(api.notifications, 'list').mockResolvedValue(notificationsResponse([notification()]))
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    await user.click(within(dialog).getByRole('button', { name: 'Ler todas' }))

    expect(
      await within(dialog).findByText('Não foi possível marcar todas as notificações como lidas.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Show de hoje/ })).toBeInTheDocument()
  })

  it('mantém o contador quando falha ao marcar uma notificação como lida', async () => {
    const markRead = vi.spyOn(api.notifications, 'markRead').mockRejectedValue(new Error('Falha.'))
    vi.spyOn(api.notifications, 'list').mockResolvedValue(notificationsResponse([notification()]))
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    await user.click(within(dialog).getByRole('link', { name: /Show de hoje/ }))

    expect(markRead).toHaveBeenCalledWith('notificacao-1')
    expect(
      await within(dialog).findByText('Não foi possível marcar esta notificação como lida.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Show de hoje/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificações, 1 não lida' })).toBeInTheDocument()
  })

  it('exibe o erro devolvido pela API ao carregar notificações', async () => {
    vi.spyOn(api.notifications, 'list').mockRejectedValue(new ApiError('Sessão expirada.', 401))
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    expect(await within(dialog).findByText('Sessão expirada.')).toBeInTheDocument()
  })

  it('exibe uma mensagem padrão quando a lista falha por outro motivo', async () => {
    vi.spyOn(api.notifications, 'list').mockRejectedValue(new Error('Falha de rede.'))
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    expect(await within(dialog).findByText('Não foi possível carregar as notificações.')).toBeInTheDocument()
  })

  it('mostra um estado vazio quando não existem lembretes', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValue(notificationsResponse([]))
    const { user } = renderWithRouter(<NotificationsMenu />)
    const dialog = await openMenu(user)

    expect(within(dialog).getByText('Você não tem lembretes de eventos próximos.')).toBeInTheDocument()
  })
})
