import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventFilters from '@/components/events/EventFilters'
import { api } from '@/services/api'

function renderFilters() {
  const onClose = vi.fn()
  return { onClose, user: userEvent.setup(), ...render(<EventFilters onClose={onClose} />) }
}

describe('EventFilters', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('começa com todas as categorias marcadas e todos os eventos', () => {
    renderFilters()
    for (const label of ['Música', 'Festivais', 'Teatro', 'Esportes', 'Artes']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeChecked()
    }
    expect(screen.getByText('8 eventos correspondem aos filtros')).toBeInTheDocument()
  })

  it('desmarcar uma categoria atualiza a contagem', async () => {
    const { user } = renderFilters()
    await user.click(screen.getByRole('checkbox', { name: 'Música' }))
    expect(screen.getByText('6 eventos correspondem aos filtros')).toBeInTheDocument()
  })

  it('"Gratuito" esconde a faixa de preço e conta só os gratuitos', async () => {
    const { user } = renderFilters()
    await user.click(screen.getByRole('radio', { name: 'Gratuito' }))
    expect(screen.queryByLabelText('Mínimo')).not.toBeInTheDocument()
    expect(screen.getByText('3 eventos correspondem aos filtros')).toBeInTheDocument()
  })

  it('digitar o preço move a bolinha do slider junto', async () => {
    const { user } = renderFilters()
    const min = screen.getByLabelText('Mínimo')
    await user.clear(min)
    await user.type(min, '100')

    expect(screen.getByRole('slider', { name: 'Preço mínimo' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('2 eventos correspondem aos filtros')).toBeInTheDocument()
  })

  it('o mínimo não passa do máximo', async () => {
    const { user } = renderFilters()
    const max = screen.getByLabelText('Máximo')
    await user.clear(max)
    await user.type(max, '80')
    const min = screen.getByLabelText('Mínimo')
    await user.clear(min)
    await user.type(min, '200')

    expect(min).toHaveValue(80)
  })

  it('mover a bolinha pelo teclado atualiza o campo', async () => {
    const { user } = renderFilters()
    screen.getByRole('slider', { name: 'Preço máximo' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByLabelText('Máximo')).toHaveValue(245)
  })

  it('Limpar volta aos filtros iniciais', async () => {
    const { user } = renderFilters()
    await user.click(screen.getByRole('checkbox', { name: 'Música' }))
    await user.click(screen.getByRole('radio', { name: 'Pago' }))
    await user.click(screen.getByRole('button', { name: 'Limpar' }))

    expect(screen.getByRole('checkbox', { name: 'Música' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Aplicar filtros envia os filtros e fecha o painel', async () => {
    const filter = vi.spyOn(api.events, 'filter').mockResolvedValue()
    const { user, onClose } = renderFilters()
    await user.click(screen.getByRole('checkbox', { name: 'Esportes' }))
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    expect(filter).toHaveBeenCalledWith({
      categories: ['music', 'festival', 'theater', 'art'],
      price: 'all',
      minPrice: 0,
      maxPrice: 250,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('o X fecha o painel', async () => {
    const { user, onClose } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'Fechar filtros' }))
    expect(onClose).toHaveBeenCalled()
  })
})
