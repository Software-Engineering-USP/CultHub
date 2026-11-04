import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EventSort from '@/components/events/EventSort'
import * as demo from '@/lib/demo'

describe('EventSort', () => {
  it('começa em Relevância e registra a ordem escolhida', async () => {
    const log = vi.spyOn(demo, 'logDemoAction').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<EventSort />)

    const trigger = screen.getByRole('combobox', { name: 'Ordenar:' })
    expect(trigger).toHaveTextContent('Relevância')

    await user.click(trigger)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Relevância',
      'Data',
      'Preço: do menor para o maior',
      'Preço: do maior para o menor',
    ])
    await user.click(screen.getByRole('option', { name: 'Preço: do maior para o menor' }))

    expect(log).toHaveBeenCalledWith('Ordenar eventos', { by: 'price-desc' })
    expect(trigger).toHaveTextContent('Preço: do maior para o menor')
    log.mockRestore()
  })
})
