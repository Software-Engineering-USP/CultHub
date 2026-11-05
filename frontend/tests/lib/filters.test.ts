import { describe, expect, it } from 'vitest'
import { events, findEvent } from '@/data/events'
import { maxPrice } from '@/lib/events'
import { defaultFilters, matchesFilters } from '@/lib/filters'

const jazz = findEvent('sp-jazz-blues-festival')! // música, R$ 120
const virada = findEvent('virada-cultural')! // festival, gratuito

describe('maxPrice', () => {
  it('é o maior preço arredondado para cima de 50 em 50', () => {
    expect(maxPrice(events)).toBe(250)
    expect(maxPrice([{ ...jazz, priceValue: 260 }])).toBe(300)
    expect(maxPrice([])).toBe(0)
  })
})

describe('matchesFilters', () => {
  const all = defaultFilters(250)

  it('os filtros iniciais aceitam todos os eventos', () => {
    expect(events.every((event) => matchesFilters(event, all))).toBe(true)
  })

  it('filtra por categoria', () => {
    expect(matchesFilters(jazz, { ...all, categories: ['art'] })).toBe(false)
    expect(matchesFilters(jazz, { ...all, categories: ['music'] })).toBe(true)
  })

  it('"Gratuito" aceita só eventos de preço zero, ignorando a faixa', () => {
    const free = { ...all, price: 'free' as const, minPrice: 100 }
    expect(matchesFilters(virada, free)).toBe(true)
    expect(matchesFilters(jazz, free)).toBe(false)
  })

  it('"Pago" exclui gratuitos e respeita a faixa', () => {
    const paid = { ...all, price: 'paid' as const }
    expect(matchesFilters(virada, paid)).toBe(false)
    expect(matchesFilters(jazz, { ...paid, minPrice: 100, maxPrice: 150 })).toBe(true)
    expect(matchesFilters(jazz, { ...paid, minPrice: 130 })).toBe(false)
  })

  it('"Todos" inclui gratuitos só se a faixa começa em zero', () => {
    expect(matchesFilters(virada, all)).toBe(true)
    expect(matchesFilters(virada, { ...all, minPrice: 10 })).toBe(false)
  })
})
