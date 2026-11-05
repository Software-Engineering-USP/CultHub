import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BackLink from '@/components/common/BackLink'
import { paths } from '@/lib/paths'
import { renderWithRouter } from '@tests/render'

describe('BackLink', () => {
  it('é um link com seta decorativa e nome limpo', () => {
    renderWithRouter(<BackLink to={paths.home}>Voltar para explorar</BackLink>)
    const link = screen.getByRole('link', { name: 'Voltar para explorar' })
    expect(link).toHaveAttribute('href', paths.home)
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
