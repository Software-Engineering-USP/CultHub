import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EventFilters from '@/components/events/EventFilters'
import { fakePermission, restoreGeolocation, stubGeolocation } from '@tests/geolocation'

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
  beforeEach(() => {
    // As datas dos testes são de dezembro de 2026; sem fixar o dia, passariam a ser "datas passadas".
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 15))
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreGeolocation()
  })

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

  it('remove a categoria da URL quando todas estão selecionadas', async () => {
    const { user } = renderFilters('/?categorias=music,festival,theater,sport,art')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    const params = new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '')
    expect(params.has('categorias')).toBe(false)
  })

  it('pede localização e aplica raio de 1 km na URL', async () => {
    stubGeolocation(fakePermission('prompt'), (success) =>
      success({ coords: { latitude: -23.55, longitude: -46.63 } } as GeolocationPosition),
    )
    const { user } = renderFilters()

    await user.click(screen.getByRole('button', { name: 'Usar minha localização' }))
    expect(await screen.findByRole('button', { name: 'Perto de mim: ativo' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Raio da busca'), '1')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    const params = new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '')
    expect(params.get('lat')).toBe('-23.55')
    expect(params.get('lng')).toBe('-46.63')
    expect(params.get('raio')).toBe('1')
  })

  it('informa quando a permissão de localização é negada', async () => {
    stubGeolocation(fakePermission('prompt'), (_success, failure) =>
      failure?.({ code: 1 } as GeolocationPositionError),
    )
    const { user } = renderFilters()

    await user.click(screen.getByRole('button', { name: 'Usar minha localização' }))
    expect(await screen.findByText(/A localização foi bloqueada/)).toBeInTheDocument()
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

  it('aplica o período na URL e restaura as datas ao reabrir', async () => {
    const { user, unmount } = renderFilters('/?q=jazz')
    await user.type(screen.getByLabelText('De'), '2026-12-01')
    await user.type(screen.getByLabelText('Até'), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    const search = screen.getByLabelText('Busca na URL').textContent ?? ''
    const params = new URLSearchParams(search)
    expect(params.get('de')).toBe('2026-12-01')
    expect(params.get('ate')).toBe('2026-12-31')
    unmount()

    renderFilters(`/${search}`)
    expect(screen.getByLabelText('De')).toHaveValue('2026-12-01')
    expect(screen.getByLabelText('Até')).toHaveValue('2026-12-31')
  })

  it('não aplica um período com a data final antes da inicial', async () => {
    const { user, onClose } = renderFilters('/?de=2026-12-10')
    await user.type(screen.getByLabelText('Até'), '2026-12-01')

    expect(screen.getByRole('alert')).toHaveTextContent('A data final não pode ser anterior à inicial.')
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('não aceita datas passadas, que sempre dariam lista vazia', async () => {
    const { user } = renderFilters()
    expect(screen.getByLabelText('De')).toHaveAttribute('min', '2026-11-15')
    expect(screen.getByLabelText('Até')).toHaveAttribute('min', '2026-11-15')

    await user.type(screen.getByLabelText('De'), '2026-10-01')
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha uma data a partir de hoje.')
    expect(screen.getByLabelText('De')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Até')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeDisabled()
  })

  it('Limpar e aplicar remove o período da URL', async () => {
    const { user } = renderFilters('/?de=2026-12-01&ate=2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.getByLabelText('De')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    const params = new URLSearchParams(screen.getByLabelText('Busca na URL').textContent ?? '')
    expect(params.has('de')).toBe(false)
    expect(params.has('ate')).toBe(false)
  })

  it('o X fecha o painel', async () => {
    const { user, onClose } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'Fechar filtros' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
