import Eyebrow from '@/components/common/Eyebrow'
import { categories } from '@/lib/categories'
import { shortName } from '@/lib/events'
import { cn } from '@/lib/utils'
import type { CultEvent } from '@/types'

/** Resumo do evento no topo das páginas de origem e rota. */
export default function EventStrip({ event }: Readonly<{ event: CultEvent }>) {
  const category = categories[event.category]

  return (
    <section
      aria-label="Resumo do evento"
      className="mb-6 flex items-center gap-5 rounded-3xl border border-border bg-card py-4 pr-5.5 pl-4 max-sm:flex-wrap max-sm:gap-3 max-sm:p-3.5"
    >
      <img
        src={event.image}
        width={112}
        height={80}
        alt={event.imageAlt}
        className="h-20 w-28 shrink-0 rounded-2xl object-cover max-sm:h-18.5 max-sm:w-20"
      />
      <div className="max-sm:min-w-0 max-sm:flex-1">
        <Eyebrow className={cn('text-2xs', category.text)}>
          {category.label} • {shortName(event)}
        </Eyebrow>
        <h2 className="my-1 text-xl max-sm:text-base">{event.title}</h2>
        <p className="text-xs text-muted-foreground">
          {event.schedule} • {event.venue}
        </p>
      </div>
      <div className="ml-auto shrink-0 text-right max-sm:flex max-sm:w-full max-sm:items-center max-sm:justify-between max-sm:border-t max-sm:border-border max-sm:pt-2.5">
        <strong className="block text-2xl tracking-tighter text-maroon max-sm:text-xl">{event.price}</strong>
      </div>
    </section>
  )
}
