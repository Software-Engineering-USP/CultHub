import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Header from '@/components/layout/Header'
import { currentUser } from '@/data/user'
import { paths } from '@/lib/paths'
import { renderWithRouter } from '@tests/render'

describe('Header', () => {
  it('mostra o avatar do usuário com link para a conta', () => {
    renderWithRouter(<Header />)
    const link = screen.getByRole('link', { name: `Ver conta de exemplo de ${currentUser.name}` })
    expect(link).toHaveAttribute('href', paths.account)
    expect(within(link).getByText(currentUser.initials)).toBeInTheDocument()
  })

  it('na tela de entrada mostra "Entrar" no lugar do avatar', () => {
    renderWithRouter(<Header />, { route: paths.signIn })
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', paths.signIn)
    expect(screen.queryByText(currentUser.initials)).not.toBeInTheDocument()
  })
})
