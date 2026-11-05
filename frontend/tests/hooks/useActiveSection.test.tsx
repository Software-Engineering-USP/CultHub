import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useActiveSection } from '@/hooks/useActiveSection'

const ids = ['dados', 'preferencias', 'comentarios']

function Page() {
  const { active, select } = useActiveSection(ids)
  return (
    <>
      <p data-testid="ativa">{active}</p>
      <button type="button" onClick={() => select('preferencias')}>
        Ir para preferências
      </button>
      {ids.map((id) => (
        <section key={id} id={id} />
      ))}
    </>
  )
}

/** Simula a posição do topo de cada seção na tela. */
function placeSections(tops: Record<string, number>) {
  for (const [id, top] of Object.entries(tops)) {
    document.getElementById(id)!.getBoundingClientRect = () => ({ top }) as DOMRect
  }
}

async function scroll() {
  await act(async () => {
    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

describe('useActiveSection', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('começa na primeira seção', () => {
    render(<Page />)
    expect(screen.getByTestId('ativa')).toHaveTextContent('dados')
  })

  it('muda para a seção cujo topo passou da linha de leitura', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(5000)
    render(<Page />)

    placeSections({ dados: -400, preferencias: 100, comentarios: 900 })
    await scroll()
    expect(screen.getByTestId('ativa')).toHaveTextContent('preferencias')

    placeSections({ dados: -1200, preferencias: -600, comentarios: 150 })
    await scroll()
    expect(screen.getByTestId('ativa')).toHaveTextContent('comentarios')
  })

  it('no fim da página, ativa a última seção', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(window.innerHeight)
    render(<Page />)
    placeSections({ dados: 0, preferencias: 600, comentarios: 900 })
    await scroll()
    expect(screen.getByTestId('ativa')).toHaveTextContent('comentarios')
  })

  it('o item clicado fica ativo mesmo sem rolagem, até a pessoa rolar', async () => {
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(window.innerHeight)
    render(<Page />)
    placeSections({ dados: -800, preferencias: -400, comentarios: 0 })
    await scroll()
    expect(screen.getByTestId('ativa')).toHaveTextContent('comentarios')

    fireEvent.click(screen.getByRole('button', { name: 'Ir para preferências' }))
    await scroll() // a página já está no fim: a rolagem automática não muda nada
    expect(screen.getByTestId('ativa')).toHaveTextContent('preferencias')

    fireEvent.wheel(window)
    await scroll()
    expect(screen.getByTestId('ativa')).toHaveTextContent('comentarios')
  })
})
