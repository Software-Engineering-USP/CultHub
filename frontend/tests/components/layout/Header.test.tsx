import { screen, within } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Header from '@/components/layout/Header'
import { currentUser } from '@/data/user'
import { categories, categoryOrder } from '@/lib/categories'
import { paths } from '@/lib/paths'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

function LocationSearch() {
  return <output aria-label="Busca na URL">{useLocation().search}</output>
}

describe('Header', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o avatar do usuário com link para a conta', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValue({
      nao_lidas: 1,
      resultados: [
        {
          id: 'notificacao-1',
          evento_id: 'evento-1',
          titulo_evento: 'Show salvo',
          data_inicio: '2026-11-18',
          hora_inicio: '20:00:00',
          local: 'Centro Cultural',
          criada_em: '2026-11-17T12:00:00Z',
          lida_em: null,
        },
      ],
    })
    renderWithRouter(<Header />)
    const link = screen.getByRole('link', { name: `Ver conta de ${currentUser.name}` })
    expect(link).toHaveAttribute('href', paths.account)
    expect(within(link).getByText(currentUser.initials)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Notificações, 1 não lida' })).toBeInTheDocument()
  })

  it('carrega o contador de notificações sem precisar abrir o sino', async () => {
    const list = vi.spyOn(api.notifications, 'list').mockResolvedValue({
      nao_lidas: 1,
      resultados: [
        {
          id: 'notificacao-1',
          evento_id: 'evento-1',
          titulo_evento: 'Show salvo',
          data_inicio: '2026-11-18',
          hora_inicio: '20:00:00',
          local: 'Centro Cultural',
          criada_em: '2026-11-17T12:00:00Z',
          lida_em: null,
        },
      ],
    })
    renderWithRouter(<Header />)

    expect(await screen.findByRole('button', { name: 'Notificações, 1 não lida' })).toBeInTheDocument()
    expect(list).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'Notificações' })).not.toBeInTheDocument()
  })

  it('abre as notificações automaticamente quando a presença gera um lembrete', async () => {
    vi.spyOn(api.notifications, 'list').mockResolvedValue({
      nao_lidas: 1,
      resultados: [
        {
          id: 'notificacao-1',
          evento_id: 'evento-1',
          titulo_evento: 'Show salvo',
          data_inicio: '2026-11-18',
          hora_inicio: '20:00:00',
          local: 'Centro Cultural',
          criada_em: '2026-11-17T12:00:00Z',
          lida_em: null,
        },
      ],
    })
    renderWithRouter(<Header />)

    window.dispatchEvent(
      new CustomEvent('culthub:notifications-updated', { detail: { eventId: 'evento-1' } }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Notificações' })
    expect(within(dialog).getByText('Show salvo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificações, 1 não lida' })).toBeInTheDocument()
  })

  it('na tela de entrada mostra "Entrar" no lugar do avatar', () => {
    renderWithRouter(<Header />, { route: paths.signIn })
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', paths.signIn)
    expect(screen.queryByText(currentUser.initials)).not.toBeInTheDocument()
  })

  it('abre o popover de filtros com as categorias e fecha com Esc', async () => {
    const { user } = renderWithRouter(<Header />)
    expect(screen.queryByText('Categorias culturais')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Filtros' }))
    const popover = screen.getByRole('dialog')
    categoryOrder.forEach((id) => expect(within(popover).getByText(categories[id].label)).toBeInTheDocument())

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('envia a busca para a URL do catálogo e permite limpar a consulta', async () => {
    const { user } = renderWithRouter(
      <>
        <Header />
        <LocationSearch />
      </>,
      { route: '/?categorias=music' },
    )
    const input = screen.getByRole('searchbox', { name: 'Buscar eventos' })
    await user.type(input, 'jazz & blues{Enter}')
    expect(new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '').get('q')).toBe(
      'jazz & blues',
    )
    expect(
      new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '').get('categorias'),
    ).toBe('music')

    const updatedInput = screen.getByRole('searchbox', { name: 'Buscar eventos' })
    await user.clear(updatedInput)
    await user.keyboard('{Enter}')
    expect(new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '').has('q')).toBe(false)
  })
})
