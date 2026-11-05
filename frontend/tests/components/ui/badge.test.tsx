import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('por padrão é o selo de categoria (claro, texto bordô, pequeno)', () => {
    render(<Badge>Música</Badge>)
    expect(screen.getByText('Música')).toHaveClass('bg-card', 'text-maroon', 'text-2xs')
  })

  it.each([
    ['muted', 'bg-muted'],
    ['success', 'bg-success'],
  ] as const)('variante %s', (variant, expected) => {
    render(<Badge variant={variant}>Status</Badge>)
    expect(screen.getByText('Status')).toHaveClass(expected)
  })

  it('aceita classes extras, como posição', () => {
    render(<Badge className="absolute top-3.5">Teatro</Badge>)
    expect(screen.getByText('Teatro')).toHaveClass('absolute', 'top-3.5')
  })
})
