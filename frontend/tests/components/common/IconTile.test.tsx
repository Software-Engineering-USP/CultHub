import { render } from '@testing-library/react'
import { MapPin } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import IconTile from '@/components/common/IconTile'

describe('IconTile', () => {
  it('mostra o ícone recebido, escondido de leitores de tela', () => {
    const { container } = render(<IconTile icon={MapPin} />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
