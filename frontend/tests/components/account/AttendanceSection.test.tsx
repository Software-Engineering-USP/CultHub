import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AttendanceSection from '@/components/account/AttendanceSection'
import { api } from '@/services/api'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

describe('AttendanceSection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra as próximas presenças e alterna para as que já passaram', async () => {
    const attendances = vi
      .spyOn(api.agenda, 'attendances')
      .mockImplementation(async (when) =>
        when === 'futuras' ? apiPage([apiEvent({ id: 'proximo', titulo: 'Show que vem' })]) : apiPage([]),
      )
    const { user } = renderWithRouter(<AttendanceSection />)

    expect(await screen.findByRole('link', { name: 'Conhecer Show que vem' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Próximas' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: 'Já fui' }))
    expect(await screen.findByText('Nenhum evento passado com presença marcada.')).toBeInTheDocument()
    expect(attendances).toHaveBeenLastCalledWith('passadas', 1)

    // Clicar de novo na opção ativa não deixa o grupo sem seleção.
    await user.click(screen.getByRole('radio', { name: 'Já fui' }))
    expect(screen.getByRole('radio', { name: 'Já fui' })).toHaveAttribute('aria-checked', 'true')
  })
})
