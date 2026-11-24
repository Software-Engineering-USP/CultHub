import { describe, expect, it } from 'vitest'
import { events, findEvent } from '@/data/events'
import { shortName, showsOfficialLink, unavailableLabel } from '@/lib/events'

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

  it('showsOfficialLink usa o status do preço e exige uma URL oficial', () => {
    expect(
      showsOfficialLink({ ...jazz, priceStatus: 'desconhecido', officialUrl: 'https://example.com/evento' }),
    ).toBe(true)
    expect(
      showsOfficialLink({ ...jazz, priceStatus: 'pago', officialUrl: 'https://example.com/evento' }),
    ).toBe(false)
    expect(showsOfficialLink({ ...jazz, priceStatus: 'desconhecido', officialUrl: undefined })).toBe(false)
  })

  it('unavailableLabel marca removidos e cancelados, mas não encerrados', () => {
    expect(unavailableLabel({ ...jazz, availability: 'removed' })).toBe('Removido')
    expect(unavailableLabel({ ...jazz, availability: 'cancelled' })).toBe('Cancelado')
    expect(unavailableLabel({ ...jazz, availability: 'ended' })).toBeUndefined()
    expect(unavailableLabel(jazz)).toBeUndefined()
  })

  it('ids dos eventos são únicos', () => {
    const ids = events.map((event) => event.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
