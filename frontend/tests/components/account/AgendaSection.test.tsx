import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgendaSection from '@/components/account/AgendaSection'
import { paths } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

describe('AgendaSection', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('lista os eventos do mês agrupados por dia, com link e marcações', async () => {
    const calendar = vi.spyOn(api.agenda, 'calendar').mockResolvedValue(
      apiPage([
        apiEvent({
          id: 'show',
          titulo: 'Show no Parque',
          data_inicio: '2026-11-14',
          presenca: true,
          salvo: true,
        }),
        apiEvent({ id: 'peca', titulo: 'Peça de domingo', data_inicio: '2026-11-15', salvo: true }),
      ]),
    )
    renderWithRouter(<AgendaSection />)

    expect(screen.getByText('novembro de 2026')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Show no Parque' })
    expect(link).toHaveAttribute('href', paths.event('show'))
    expect(calendar).toHaveBeenCalledWith('2026-11-01', '2026-11-30', 1)

    const firstDay = screen.getByRole('heading', { name: 'sábado, 14 de novembro' }).closest('li')!
    expect(within(firstDay).getByText('Vou')).toBeInTheDocument()
    expect(within(firstDay).getByText('Salvo')).toBeInTheDocument()
    const secondDay = screen.getByRole('heading', { name: 'domingo, 15 de novembro' }).closest('li')!
    expect(within(secondDay).queryByText('Vou')).not.toBeInTheDocument()
  })

  it('troca de mês pelos botões e avisa quando não há nada', async () => {
    const calendar = vi.spyOn(api.agenda, 'calendar').mockResolvedValue(apiPage([]))
    const { user } = renderWithRouter(<AgendaSection />)

    expect(await screen.findByText('Nada na sua agenda em novembro de 2026.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByText('Nada na sua agenda em dezembro de 2026.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))

    expect(await screen.findByText('outubro de 2026')).toBeInTheDocument()
    expect(calendar).toHaveBeenLastCalledWith('2026-10-01', '2026-10-31', 1)
  })

  it('mostra o erro da API', async () => {
    vi.spyOn(api.agenda, 'calendar').mockRejectedValue(new ApiError('Período inválido.', 400))
    renderWithRouter(<AgendaSection />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Período inválido.')
  })
})
