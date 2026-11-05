import { render, screen } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('é type="button" por padrão, para não enviar formulários sem querer', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button')
  })

  it('respeita type="submit"', () => {
    render(<Button type="submit">Entrar</Button>)
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute('type', 'submit')
  })

  it('com asChild, aplica o estilo no link em vez de criar um botão', () => {
    render(
      <MemoryRouter>
        <Button asChild variant="outline">
          <Link to="/conta">Minha conta</Link>
        </Button>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Minha conta' })
    expect(link).toHaveAttribute('href', '/conta')
    expect(link).not.toHaveAttribute('type')
    expect(link).toHaveClass('border-border')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('block ocupa a largura toda e className sobrescreve o padrão', () => {
    render(
      <Button block className="px-8">
        Continuar
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveClass('w-full', 'px-8')
    expect(button).not.toHaveClass('px-5')
  })

  it('linkMuted usa texto pequeno, sem padding de botão', () => {
    render(<Button variant="linkMuted">Responder</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-xs', 'px-0')
    expect(button).not.toHaveClass('text-sm', 'min-h-11')
  })
})
