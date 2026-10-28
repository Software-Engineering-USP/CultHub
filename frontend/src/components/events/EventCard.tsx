import { Link } from 'react-router-dom'
import type { CultEvent } from '../../data/events'
import { categories } from '../../lib/categories'
import { cn } from '../../lib/cn'
import CategoryBadge from '../ui/CategoryBadge'
import { CalendarIcon, PinIcon } from '../ui/Icons'

interface EventCardProps {
  event: CultEvent
  /** Mostra ícones de local/data nas linhas de informação */
  icons?: boolean
  /** Versão menor, usada em "Eventos salvos" */
  compact?: boolean
  /** Carrega a imagem imediatamente (primeiro card visível) */
  priority?: boolean
}

export default function EventCard({
  event,
  icons = false,
  compact = false,
  priority = false,
}: EventCardProps) {
  const category = categories[event.category]
  const href = event.details ? `/eventos/${event.id}` : null
  const shortName = event.shortTitle ?? event.title

  const image = (
    <img
      src={event.image}
      alt={event.imageAlt}
      loading={priority ? undefined : 'lazy'}
      className={cn('block w-full object-cover', compact ? 'h-[170px]' : 'h-[192px]')}
    />
  )

  return (
    <article
      className={cn('overflow-hidden rounded-[22px] border border-[#e1d8ca] shadow-card', category.card)}
    >
      <div className="relative">
        {href ? (
          <Link to={href} aria-label={`Conhecer ${event.title}`}>
            {image}
          </Link>
        ) : (
          image
        )}
        <CategoryBadge className="absolute top-[14px] left-[14px] shadow-badge">
          {category.label}
        </CategoryBadge>
      </div>

      <div className={compact ? 'p-5' : 'p-[22px] max-lg:p-[19px] max-sm:p-[22px]'}>
        <h3 className="mb-[10px]">
          {href ? (
            <Link to={href} className="no-underline hover:underline">
              {event.title}
            </Link>
          ) : (
            event.title
          )}
        </h3>
        <p className="mb-[18px] min-h-[63px] text-[13px] leading-[1.65] max-sm:min-h-0">
          {event.description}
        </p>

        <div className="grid gap-[7px] text-[12px]">
          {icons ? (
            <>
              <p className="flex items-start gap-2">
                <PinIcon />
                {event.venue}
              </p>
              <p className="flex items-start gap-2">
                <CalendarIcon />
                {event.schedule}
              </p>
            </>
          ) : (
            <>
              <p>{event.venue}</p>
              <p>{event.schedule}</p>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-[10px] border-t border-maroon/12 pt-4 text-[16px] font-[750] text-maroon">
          <span>{event.price}</span>
          {href ? (
            <Link
              to={href}
              aria-label={`Ver detalhes do ${shortName}`}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-maroon/22 text-[19px] no-underline"
            >
              ↗
            </Link>
          ) : (
            <span className="text-[10px] font-normal text-ink">Evento de exemplo</span>
          )}
        </div>
      </div>
    </article>
  )
}
