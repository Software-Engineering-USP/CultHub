import { describe, expect, it } from 'vitest'
import { formatMemberSince, toAttendee, toPublicProfile } from '@/services/users'

describe('toPublicProfile', () => {
  it('traduz os campos da API', () => {
    expect(
      toPublicProfile({
        id: 'u1',
        nome: 'Caio Prado',
        iniciais: 'CP',
        cidade: '',
        preferencias: ['art'],
        membro_desde: '2026-11-05',
      }),
    ).toEqual({
      id: 'u1',
      name: 'Caio Prado',
      initials: 'CP',
      city: '',
      preferences: ['art'],
      memberSince: '2026-11-05',
    })
  })
})

describe('toAttendee', () => {
  it('traduz os campos da API', () => {
    expect(toAttendee({ id: 'u1', nome: 'Caio Prado', iniciais: 'CP' })).toEqual({
      id: 'u1',
      name: 'Caio Prado',
      initials: 'CP',
    })
  })
})

describe('formatMemberSince', () => {
  it('mostra mês e ano', () => {
    expect(formatMemberSince('2026-11-05')).toBe('novembro de 2026')
  })

  it('não muda de mês no primeiro dia, qualquer que seja o fuso', () => {
    expect(formatMemberSince('2026-01-01')).toBe('janeiro de 2026')
  })

  it('devolve o texto original se a data vier em outro formato', () => {
    expect(formatMemberSince('ontem')).toBe('ontem')
  })
})
