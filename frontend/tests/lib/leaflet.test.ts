import { describe, expect, it } from 'vitest'
import { markerPin, pin } from '@/lib/leaflet'

describe('lib/leaflet', () => {
  it('a gota tem nome acessível, cor por classe e ponta no lugar marcado', () => {
    const icon = markerPin('text-dot-music', 'Show no parque')
    const html = icon.options.html as HTMLElement

    expect(html.getAttribute('role')).toBe('img')
    expect(html.getAttribute('aria-label')).toBe('Show no parque')
    expect(html.className).toContain('text-dot-music')
    expect(html.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // A ponta (centro, embaixo) é o ponto do evento.
    expect(icon.options.iconAnchor).toEqual([18, 33])
  })

  it('define o degradê da sombra uma vez só, mesmo com vários pinos', () => {
    markerPin('text-maroon', 'A')
    markerPin('text-maroon', 'B')
    expect(document.querySelectorAll('#culthub-pin-sombra')).toHaveLength(1)
  })

  it('empilha apenas cores distintas e mantém a contagem no pin agrupado', () => {
    const stacked = markerPin('text-dot-music', '2 eventos', 2, ['text-dot-theater', 'text-dot-music'])
    const html = stacked.options.html as HTMLElement

    expect(stacked.options.iconSize).toEqual([64, 48])
    expect(stacked.options.iconAnchor).toEqual([18, 43])
    expect(html.querySelectorAll('svg')).toHaveLength(2)
    expect(html.querySelector('.text-dot-theater')).not.toBeNull()
    expect(html.querySelector('.text-dot-music')).not.toBeNull()
    expect(html.textContent).toContain('2')

    const sameColor = markerPin('text-dot-music', '2 eventos', 2, ['text-dot-music', 'text-dot-music'])
    expect((sameColor.options.html as HTMLElement).querySelectorAll('svg')).toHaveLength(1)
  })

  it('não interpreta o nome como HTML', () => {
    const nome = '<img src=x onerror="alert(1)">'
    const html = markerPin('text-maroon', nome).options.html as HTMLElement
    expect(html.querySelector('img')).toBeNull()
    expect(html.getAttribute('aria-label')).toBe(nome)
  })

  it('a bolinha continua centralizada no ponto', () => {
    expect(pin('bg-sun', 'Partida').options.iconAnchor).toEqual([10, 10])
  })
})
