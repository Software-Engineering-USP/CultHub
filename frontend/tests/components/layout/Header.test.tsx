import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Header from '@/components/layout/Header'
import { currentUser } from '@/data/user'
import { categories, categoryOrder } from '@/lib/categories'
import { paths } from '@/lib/paths'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

describe('Header', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o avatar do usuário com link para a conta', () => {
    renderWithRouter(<Header />)
    const link = screen.getByRole('link', { name: `Ver conta de ${currentUser.name}` })
    expect(link).toHaveAttribute('href', paths.account)
    expect(within(link).getByText(currentUser.initials)).toBeInTheDocument()
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

  it('enviar a busca chama a API com o texto digitado', async () => {
    const search = vi.spyOn(api.events, 'search').mockResolvedValue()
    const { user } = renderWithRouter(<Header />)
    await user.type(screen.getByRole('searchbox', { name: 'Buscar eventos' }), 'jazz{Enter}')
    expect(search).toHaveBeenCalledWith('jazz')
  })
})
