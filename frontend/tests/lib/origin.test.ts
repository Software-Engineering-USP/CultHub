import { describe, expect, it } from 'vitest'
import {
  formatDistance,
  formatDuration,
  openStreetMapDirections,
  originSearch,
  parseMode,
  parseOrigin,
} from '@/lib/origin'

describe('origin', () => {
  it('leva a origem e o modo pela query string e volta igual', () => {
    const search = originSearch({ latitude: -23.5, longitude: -46.6, label: 'Rua A, 10' }, 'ape')
    expect(search).toBe('?latitude=-23.5&longitude=-46.6&rotulo=Rua+A%2C+10&modo=ape')
    const params = new URLSearchParams(search)
    expect(parseOrigin(params)).toEqual({ latitude: -23.5, longitude: -46.6, label: 'Rua A, 10' })
    expect(parseMode(params)).toBe('ape')
  })

  it('omite o rótulo desconhecido', () => {
    const search = originSearch({ latitude: 1, longitude: 2, label: null })
    expect(search).toBe('?latitude=1&longitude=2')
    expect(parseOrigin(new URLSearchParams(search))).toEqual({ latitude: 1, longitude: 2, label: null })
  })

  it.each([
    '',
    '?latitude=1',
    '?latitude=abc&longitude=2',
    '?latitude=91&longitude=0',
    '?latitude=0&longitude=181',
  ])('ignora origem ausente ou inválida (%s)', (search) => {
    expect(parseOrigin(new URLSearchParams(search))).toBeUndefined()
  })

  it.each(['aviao', 'onibus'])('ignora modo desconhecido ou indisponível (%s)', (modo) => {
    expect(parseMode(new URLSearchParams({ modo }))).toBeUndefined()
  })

  it.each([
    [30, '30 s'],
    [0, '1 s'],
    [1121, '19 min'],
    [8700, '2 h 25 min'],
    [10_800, '3 h'],
  ])('formata %i segundos como "%s"', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it.each([
    [850.4, '850 m'],
    [1000, '1 km'],
    [10_722, '10,7 km'],
  ])('formata %i metros como "%s"', (meters, text) => {
    expect(formatDistance(meters)).toBe(text)
  })

  it('monta o link de rota do OpenStreetMap com o motor do modo', () => {
    const origem = { latitude: -23.5, longitude: -46.6 }
    const destino = { latitude: -23.6, longitude: -46.7 }
    const carro = new URL(openStreetMapDirections(origem, destino, 'carro'))
    expect(carro.origin + carro.pathname).toBe('https://www.openstreetmap.org/directions')
    expect(carro.searchParams.get('engine')).toBe('fossgis_osrm_car')
    expect(carro.searchParams.get('route')).toBe('-23.5,-46.6;-23.6,-46.7')
    const aPe = new URL(openStreetMapDirections(origem, destino, 'ape'))
    expect(aPe.searchParams.get('engine')).toBe('fossgis_osrm_foot')
  })
})
