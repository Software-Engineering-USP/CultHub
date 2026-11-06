import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StaticMap from '@/components/common/StaticMap'

const props = {
  src: '/assets/mapa.png',
  alt: 'Mapa ilustrativo',
  width: 856,
  height: 690,
  caption: 'Imagem estática.',
}

describe('StaticMap', () => {
  it('mostra a imagem com o aviso como legenda da figura', () => {
    render(<StaticMap {...props} />)
    const figure = screen.getByRole('figure')
    expect(figure.querySelector('figcaption')).toHaveTextContent('Imagem estática.')
    const image = screen.getByRole('img', { name: 'Mapa ilustrativo' })
    expect(figure).toContainElement(image)
    expect(image).toHaveAttribute('src', '/assets/mapa.png')
    expect(image).toHaveAttribute('width', '856')
  })

  it('coloca a legenda extra antes do aviso', () => {
    render(<StaticMap {...props} legend={<ul aria-label="Legenda de categorias" />} />)
    const legend = screen.getByRole('list', { name: 'Legenda de categorias' })
    expect(legend.nextElementSibling).toHaveTextContent('Imagem estática.')
  })
})
