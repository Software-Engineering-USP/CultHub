import { describe, expect, it } from 'vitest'
import { addMonths, currentMonth, groupByDay, monthLabel, monthRange } from '@/lib/agenda'
import { toCultEvent } from '@/services/catalog'
import { apiEvent } from '@tests/fixtures/catalog'

describe('agenda', () => {
  it('pega o mês atual e avança ou volta virando o ano', () => {
    expect(currentMonth(new Date(2026, 10, 12))).toEqual({ year: 2026, month: 10 })
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })

  it('monta o período do mês no formato da API, inclusive em fevereiro bissexto', () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange({ year: 2028, month: 1 })).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('escreve o mês por extenso em português', () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe('novembro de 2026')
  })

  it('agrupa por dia de início, na ordem da API, e ignora eventos sem data', () => {
    const events = [
      toCultEvent(apiEvent({ id: 'a', data_inicio: '2026-11-03' })),
      toCultEvent(apiEvent({ id: 'b', data_inicio: '2026-11-05' })),
      toCultEvent(apiEvent({ id: 'c', data_inicio: '2026-11-03' })),
      { ...toCultEvent(apiEvent({ id: 'd' })), eventDate: undefined },
    ]
    const days = groupByDay(events)

    expect(days.map((day) => [day.date, day.events.map((event) => event.id)])).toEqual([
      ['2026-11-03', ['a', 'c']],
      ['2026-11-05', ['b']],
    ])
    expect(days[0].label).toBe('terça-feira, 3 de novembro')
  })

  it('coloca no primeiro dia do período os eventos que começaram antes dele', () => {
    const events = [
      toCultEvent(apiEvent({ id: 'em-andamento', data_inicio: '2026-10-28', data_fim: '2026-11-05' })),
      toCultEvent(apiEvent({ id: 'dia-1', data_inicio: '2026-11-01' })),
      toCultEvent(apiEvent({ id: 'dia-3', data_inicio: '2026-11-03' })),
    ]

    expect(groupByDay(events, '2026-11-01').map((day) => [day.date, day.events.map((e) => e.id)])).toEqual([
      ['2026-11-01', ['em-andamento', 'dia-1']],
      ['2026-11-03', ['dia-3']],
    ])
  })
})
