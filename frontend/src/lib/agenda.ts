import type { EventWithDetails } from '@/types'

export interface Month {
  year: number
  /** 0 = janeiro */
  month: number
}

export interface AgendaDay {
  /** AAAA-MM-DD */
  date: string
  label: string
  events: EventWithDetails[]
}

const pad = (value: number) => String(value).padStart(2, '0')

export function currentMonth(today = new Date()): Month {
  return { year: today.getFullYear(), month: today.getMonth() }
}

export function addMonths({ year, month }: Month, amount: number): Month {
  const date = new Date(year, month + amount, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/** Primeiro e último dia do mês, no formato que a API espera (AAAA-MM-DD). */
export function monthRange({ year, month }: Month): { from: string; to: string } {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  }
}

/** Ex.: "novembro de 2026". */
export function monthLabel({ year, month }: Month): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))
}

/** Agrupa pelo dia de início, na ordem da API. Eventos de vários dias aparecem só no dia em que começam. */
export function groupByDay(events: EventWithDetails[]): AgendaDay[] {
  const days = new Map<string, AgendaDay>()
  for (const event of events) {
    const date = event.startDate
    if (!date) continue
    const day = days.get(date) ?? { date, label: dayLabel(date), events: [] }
    day.events.push(event)
    days.set(date, day)
  }
  return [...days.values()]
}

function dayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day),
  )
}
