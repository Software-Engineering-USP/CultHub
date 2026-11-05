import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Surface from '@/components/common/Surface'

describe('Surface', () => {
  it('usa o fundo e o padding padrão', () => {
    render(<Surface data-testid="painel" />)
    expect(screen.getByTestId('painel')).toHaveClass('bg-card', 'p-7')
  })

  it('className troca o fundo e o padding padrão', () => {
    render(<Surface data-testid="painel" className="bg-cream p-6" />)
    const panel = screen.getByTestId('painel')
    expect(panel).toHaveClass('bg-cream', 'p-6')
    expect(panel).not.toHaveClass('bg-card', 'p-7')
  })

  it('renderiza a tag pedida em "as" e repassa os atributos', () => {
    render(<Surface as="section" aria-label="Resumo" />)
    expect(screen.getByRole('region', { name: 'Resumo' }).tagName).toBe('SECTION')
  })

  it('ignora o antigo padded, sem repassá-lo ao DOM', () => {
    render(<Surface data-testid="painel" padded={false} />)
    expect(screen.getByTestId('painel')).not.toHaveAttribute('padded')
  })
})
