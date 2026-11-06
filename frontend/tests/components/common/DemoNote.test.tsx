import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DemoNote from '@/components/common/DemoNote'

describe('DemoNote', () => {
  it('é um parágrafo text-xs por padrão', () => {
    render(<DemoNote>Demonstração</DemoNote>)
    const note = screen.getByText('Demonstração')
    expect(note.tagName).toBe('P')
    expect(note).toHaveClass('text-xs', 'text-muted-foreground')
  })

  it.each([
    ['xs', 'text-2xs'],
    ['sm', 'text-xs'],
    ['md', 'text-sm'],
  ] as const)('size="%s" usa %s', (size, className) => {
    render(<DemoNote size={size}>Aviso</DemoNote>)
    expect(screen.getByText('Aviso')).toHaveClass(className)
  })

  it('renderiza a tag pedida em "as"', () => {
    render(
      <figure>
        <DemoNote as="figcaption">Legenda</DemoNote>
      </figure>,
    )
    expect(screen.getByText('Legenda').tagName).toBe('FIGCAPTION')
  })
})
