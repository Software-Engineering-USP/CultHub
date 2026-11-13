import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ListStatus from '@/components/account/ListStatus'
import SectionHeading from '@/components/common/SectionHeading'
import Surface from '@/components/common/Surface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCalendar } from '@/hooks/useUserEvents'
import { addMonths, currentMonth, groupByDay, monthLabel, monthRange } from '@/lib/agenda'
import { paths } from '@/lib/paths'

export default function AgendaSection() {
  const [month, setMonth] = useState(currentMonth)
  const { from, to } = monthRange(month)
  const { events, loading, error } = useCalendar(from, to)
  const days = groupByDay(events, from)
  const label = monthLabel(month)

  return (
    <Surface as="section" id="agenda" aria-labelledby="agenda-titulo">
      <SectionHeading
        id="agenda-titulo"
        title="Minha agenda"
        description="Eventos que você salvou ou em que vai, mês a mês."
        className="mb-5"
        titleClassName="text-2xl"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((value) => addMonths(value, -1))}>
            <ArrowLeft />
            <span className="sr-only">Mês anterior</span>
          </Button>
          <p aria-live="polite" className="min-w-36 text-center text-sm font-semibold first-letter:uppercase">
            {label}
          </p>
          <Button variant="outline" size="icon" onClick={() => setMonth((value) => addMonths(value, 1))}>
            <ArrowRight />
            <span className="sr-only">Próximo mês</span>
          </Button>
        </div>
      </SectionHeading>

      <ListStatus
        loading={loading}
        error={error}
        empty={!days.length}
        emptyMessage={`Nada na sua agenda em ${label}.`}
      />

      <ol className="grid gap-5">
        {days.map((day) => (
          <li key={day.date}>
            <h3 className="mb-2 text-sm first-letter:uppercase">{day.label}</h3>
            <ul className="grid gap-2">
              {day.events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 max-sm:flex-col max-sm:items-start"
                >
                  <div className="min-w-0">
                    <Link
                      to={paths.event(event.id)}
                      className="font-semibold text-maroon no-underline hover:underline"
                    >
                      {event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {event.details.startTime} • {event.venue}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {event.attending && <Badge variant="success">Vou</Badge>}
                    {event.saved && <Badge variant="muted">Salvo</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Surface>
  )
}
