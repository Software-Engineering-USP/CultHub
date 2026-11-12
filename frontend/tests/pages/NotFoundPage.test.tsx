import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { paths } from '@/lib/paths'
import NotFoundPage from '@/pages/NotFoundPage'
import { renderWithRouter } from '@tests/render'

describe('NotFoundPage', () => {
  it('avisa que a página não existe e leva de volta para explorar', () => {
    renderWithRouter(<NotFoundPage />, { route: '/nao-existe' })
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByText('O endereço acessado não existe nesta demonstração.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para explorar' })).toHaveAttribute('href', paths.home)
    expect(document.title).toBe('Página não encontrada | CultHub')
  })
})
