import { describe, expect, it } from 'vitest'
import { paths } from '@/lib/paths'

describe('paths', () => {
  it('monta os links das páginas de evento', () => {
    expect(paths.event('sp-jazz')).toBe('/eventos/sp-jazz')
    expect(paths.eventOrigin('sp-jazz')).toBe('/eventos/sp-jazz/origem')
    expect(paths.eventRoute('sp-jazz')).toBe('/eventos/sp-jazz/rota')
  })

  it('codifica caracteres especiais no id', () => {
    expect(paths.event('a b')).toBe('/eventos/a%20b')
  })
})
