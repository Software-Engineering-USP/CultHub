import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CategoryList from '@/components/common/CategoryList'
import { categories, categoryOrder } from '@/lib/categories'

describe('CategoryList', () => {
  it('lista todas as categorias, na ordem definida', () => {
    render(<CategoryList aria-label="Legenda" />)
    const items = within(screen.getByRole('list', { name: 'Legenda' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(categoryOrder.map((id) => categories[id].label))
  })
})
