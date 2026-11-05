import { describe, expect, it } from 'vitest'
import { events, findEvent } from '@/data/events'
import { hasDetails, shortName } from '@/lib/events'

const jazz = findEvent('sp-jazz-blues-festival')!
const semDetalhes = findEvent('derby-paulista')!

describe('lib/events', () => {
  it('findEvent encontra pelo id e devolve undefined para ids desconhecidos', () => {
    expect(jazz.title).toBe('São Paulo Jazz & Blues Festival')
    expect(findEvent('nao-existe')).toBeUndefined()
  })

  it('shortName usa shortTitle e cai para o título', () => {
    expect(shortName(jazz)).toBe('Jazz & Blues')
    expect(shortName(semDetalhes)).toBe(semDetalhes.title)
  })

  it('hasDetails só aceita eventos com página própria', () => {
    expect(hasDetails(jazz)).toBe(true)
    expect(hasDetails(semDetalhes)).toBe(false)
    expect(hasDetails(undefined)).toBe(false)
  })

  it('ids dos eventos são únicos', () => {
    const ids = events.map((event) => event.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
