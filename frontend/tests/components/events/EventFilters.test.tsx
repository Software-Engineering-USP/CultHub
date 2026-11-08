import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EventFilters from '@/components/events/EventFilters'

function LocationSearch() {
  const location = useLocation()
  return <output aria-label="Busca na URL">{location.search}</output>
}

function renderFilters(route = '/') {
  const onClose = vi.fn()
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <EventFilters onClose={onClose} />
      <LocationSearch />
    </MemoryRouter>,
  )
  return { ...result, onClose, user }
}

describe('EventFilters', () => {
  it('inicia com todas as categorias e qualquer preço selecionados', () => {
    renderFilters()
    for (const label of ['Música', 'Festivais', 'Teatro', 'Esportes', 'Artes']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeChecked()
    }
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true')
  })

  it('restaura os filtros atuais a partir da querystring', () => {
    renderFilters('/?q=jazz&categorias=music,art&preco=gratuito')
    expect(screen.getByRole('checkbox', { name: 'Música' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Artes' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Festivais' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Gratuito' })).toHaveAttribute('aria-checked', 'true')
  })

  it('aplica categorias e preço na URL, preserva a busca e fecha o painel', async () => {
    const { user, onClose } = renderFilters('/?q=jazz')
    await user.click(screen.getByRole('checkbox', { name: 'Esportes' }))
    await user.click(screen.getByRole('radio', { name: 'Gratuito' }))
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    const params = new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '')
    expect(params.get('q')).toBe('jazz')
    expect(params.get('categorias')).toBe('music,festival,theater,art')
    expect(params.get('preco')).toBe('gratuito')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('não permite desmarcar a última categoria e deixar uma consulta ambígua', async () => {
    const { user } = renderFilters('/?categorias=music')
    await user.click(screen.getByRole('checkbox', { name: 'Música' }))
    expect(screen.getByRole('checkbox', { name: 'Música' })).toBeChecked()
  })

  it('Limpar redefine as seleções antes de aplicar', async () => {
    const { user } = renderFilters()
    await user.click(screen.getByRole('checkbox', { name: 'Música' }))
    await user.click(screen.getByRole('radio', { name: 'Pago' }))
    await user.click(screen.getByRole('button', { name: 'Limpar' }))

    expect(screen.getByRole('checkbox', { name: 'Música' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Todos' })).toHaveAttribute('aria-checked', 'true')
  })

  it('o X fecha o painel', async () => {
    const { user, onClose } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'Fechar filtros' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
