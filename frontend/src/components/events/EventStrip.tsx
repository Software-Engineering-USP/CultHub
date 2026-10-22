import type { CultEvent } from '../../data/events'
import { categories } from '../../lib/categories'
import Eyebrow from '../ui/Eyebrow'

/** Resumo do evento no topo das páginas de origem e rota. */
export default function EventStrip({ event }: { event: CultEvent }) {
  return (
    <section
      aria-label="Resumo do evento"
      className="mb-6 flex items-center gap-5 rounded-[23px] border border-line bg-surface py-4 pl-4 pr-[22px] max-sm:flex-wrap max-sm:gap-[13px] max-sm:p-[14px]"
    >
      <img
        src={event.image}
        width={112}
        height={80}
        alt={event.imageAlt}
        className="h-20 w-28 shrink-0 rounded-[15px] object-cover max-sm:h-[74px] max-sm:w-20"
      />
      <div className="max-sm:min-w-0 max-sm:flex-1">
        <Eyebrow className="text-[9px] text-[#945026] max-sm:text-[8px]">
          {categories[event.category].label} • {event.shortTitle ?? event.title}
        </Eyebrow>
        <h2 className="mb-[5px] mt-[3px] text-[20px] max-sm:text-[16px]">{event.title}</h2>
        <p className="text-[11px] text-muted">
          {event.schedule} • {event.venue}
        </p>
      </div>
      <div className="ml-auto shrink-0 text-right max-sm:flex max-sm:w-full max-sm:items-center max-sm:justify-between max-sm:border-t max-sm:border-line max-sm:pt-[10px]">
        <strong className="block text-[22px] tracking-[-.04em] text-maroon max-sm:text-[19px]">
          {event.price}
        </strong>
        <small className="text-[10px]">Preço do exemplo</small>
      </div>
    </section>
  )
}
