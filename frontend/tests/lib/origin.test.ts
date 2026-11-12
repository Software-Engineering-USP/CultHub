import { describe, expect, it } from 'vitest'
import { originSearch, parseMode, parseOrigin } from '@/lib/origin'

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

  it('ignora modo desconhecido', () => {
    expect(parseMode(new URLSearchParams('?modo=aviao'))).toBeUndefined()
  })
})
