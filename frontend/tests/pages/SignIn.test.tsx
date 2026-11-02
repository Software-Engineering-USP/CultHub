import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SignIn from '@/pages/SignIn'
import { api } from '@/services/api'
import { renderWithRouter } from '@tests/render'

describe('SignIn', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('"Esqueci minha senha" pede a recuperação com o e-mail digitado', async () => {
    const forgot = vi.spyOn(api.auth, 'forgotPassword').mockResolvedValue()
    const { user } = renderWithRouter(<SignIn />)

    await user.type(screen.getAllByLabelText('E-mail')[0], 'voce@exemplo.com')
    await user.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))

    expect(forgot).toHaveBeenCalledWith('voce@exemplo.com')
  })
})
