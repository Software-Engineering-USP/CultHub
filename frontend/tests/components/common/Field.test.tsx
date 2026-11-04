import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Field from '@/components/common/Field'

describe('Field', () => {
  it('liga o rótulo ao campo', () => {
    render(<Field id="nome" name="nome" label="Nome" />)
    expect(screen.getByLabelText('Nome')).toHaveAttribute('name', 'nome')
  })

  it('liga o texto de ajuda ao campo, para leitores de tela', () => {
    render(<Field id="senha" label="Senha" help="Use pelo menos 8 caracteres." />)
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Use pelo menos 8 caracteres.')
  })
})
