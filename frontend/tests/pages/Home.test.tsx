import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { categoryOrder } from '@/lib/categories'
import * as demo from '@/lib/demo'
import Home from '@/pages/Home'
import { renderWithRouter } from '@tests/render'

describe('Home', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('"Minha Localização" registra o pedido no console', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const { user } = renderWithRouter(<Home />)
    await user.click(screen.getByRole('button', { name: /Minha Localização/ }))
    expect(log).toHaveBeenCalledWith('Pedir localização do usuário')
  })

  it('mostra a legenda do mapa e os destaques no carrossel', () => {
    renderWithRouter(<Home />)
    expect(
      within(screen.getByRole('list', { name: 'Legenda de categorias' })).getAllByRole('listitem'),
    ).toHaveLength(categoryOrder.length)
    expect(screen.getByRole('region', { name: /experiências em destaque/ })).toBeInTheDocument()
  })
})
