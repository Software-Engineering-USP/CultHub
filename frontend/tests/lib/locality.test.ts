import { describe, expect, it } from 'vitest'
import { findCity, formatLocality, matchCities, normalizePlaceName } from '@/lib/locality'

describe('formatLocality', () => {
  it('junta cidade e UF e aceita uma só', () => {
    expect(formatLocality('São Paulo', 'SP')).toBe('São Paulo, SP')
    expect(formatLocality('', 'SP')).toBe('SP')
    expect(formatLocality('Bom Jesus', '')).toBe('Bom Jesus')
    expect(formatLocality('', '')).toBe('')
  })
})

describe('normalizePlaceName', () => {
  it('ignora caixa, acento, tipo de apóstrofo e espaço repetido', () => {
    expect(normalizePlaceName('  São   Paulo ')).toBe('sao paulo')
    expect(normalizePlaceName('Olho D’Água')).toBe(normalizePlaceName("olho d'agua"))
  })

  it.each(['´', '`', 'ʼ', '’', '‘'])('trata "%s" como apóstrofo, como o backend', (apostrophe) => {
    expect(normalizePlaceName(`Dias d${apostrophe}Ávila`)).toBe("dias d'avila")
    expect(findCity(["Dias d'Ávila"], `dias d${apostrophe}avila`)).toBe("Dias d'Ávila")
  })
})

describe('matchCities', () => {
  const cities = ['Campinas', 'Santa Rita do Passa Quatro', 'Santos', 'São Paulo']

  it('põe primeiro as que começam com o texto e respeita o limite', () => {
    expect(matchCities(cities, 'san', 10)).toEqual(['Santa Rita do Passa Quatro', 'Santos'])
    expect(matchCities(cities, 'pa', 10)).toEqual(['Santa Rita do Passa Quatro', 'São Paulo'])
    expect(matchCities(cities, 'sa', 1)).toEqual(['Santa Rita do Passa Quatro'])
  })

  it('sem texto, não sugere nada', () => {
    expect(matchCities(cities, '  ', 10)).toEqual([])
  })
})

describe('findCity', () => {
  it('devolve o nome oficial', () => {
    expect(findCity(['São Paulo'], 'sao paulo')).toBe('São Paulo')
    expect(findCity(['São Paulo'], 'Sampa')).toBeUndefined()
  })
})
