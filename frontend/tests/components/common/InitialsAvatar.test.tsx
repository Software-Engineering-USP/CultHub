import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import InitialsAvatar from '@/components/common/InitialsAvatar'

describe('InitialsAvatar', () => {
  it('mostra as iniciais', () => {
    render(<InitialsAvatar initials="LC" />)
    expect(screen.getByText('LC')).toBeInTheDocument()
  })

  it('aplica o tamanho escolhido', () => {
    const { container } = render(<InitialsAvatar initials="LC" size="lg" />)
    expect(container.firstChild).toHaveAttribute('data-size', 'lg')
  })
})
