import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SectionHeading from '@/components/common/SectionHeading'

describe('SectionHeading', () => {
  it('mostra o título no nível pedido, a descrição e o conteúdo da direita', () => {
    render(
      <SectionHeading as="h1" title="Como chegar" description="Defina a origem">
        <button type="button">Ação</button>
      </SectionHeading>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Como chegar' })).toBeInTheDocument()
    expect(screen.getByText('Defina a origem')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ação' })).toBeInTheDocument()
  })

  it('usa h2 e mb-6 por padrão; className troca a margem', () => {
    const { container, rerender } = render(<SectionHeading title="Comentários" />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('mb-6')

    rerender(<SectionHeading title="Comentários" className="mb-7" />)
    expect(container.firstChild).toHaveClass('mb-7')
    expect(container.firstChild).not.toHaveClass('mb-6')
  })

  it('ainda aceita variant="page" e marginClass, que serão removidos', () => {
    const { container, rerender } = render(<SectionHeading title="Conta" variant="page" />)
    expect(container.firstChild).toHaveClass('mb-7')

    rerender(<SectionHeading title="Conta" marginClass="mb-5" />)
    expect(container.firstChild).toHaveClass('mb-5')
  })
})
