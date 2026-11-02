import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
})
