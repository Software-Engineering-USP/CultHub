import { ArrowUpRight, Calendar, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { categories } from '@/lib/categories'
import { shortName } from '@/lib/events'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CultEvent } from '@/types'

interface EventCardProps {
  event: CultEvent
  /** Versão com imagem menor, usada em "Eventos salvos" */
  compact?: boolean
  /** Carrega a imagem imediatamente (primeiro card visível) */
  priority?: boolean
}

export default function EventCard({ event, compact = false, priority = false }: Readonly<EventCardProps>) {
  const category = categories[event.category]
  const href = paths.event(event.id)
  const info = [
    { icon: MapPin, text: event.venue },
    { icon: Calendar, text: event.schedule },
  ]

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-3xl border border-border shadow-card',
        category.card,
      )}
    >
      <div className="relative">
        <Link to={href} aria-label={`Conhecer ${event.title}`}>
          <img
            src={event.image}
            alt={event.imageAlt}
            loading={priority ? undefined : 'lazy'}
            className={cn('block w-full object-cover', compact ? 'h-32' : 'h-36')}
          />
        </Link>
        <Badge className={cn('absolute bottom-3 left-3 bg-card/90 font-medium shadow-badge', category.text)}>
          {category.label}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg">
          <Link to={href} className="no-underline hover:underline">
            {event.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-2 text-xs">{event.description}</p>

        <div className="mt-3 mb-4 grid gap-2 text-xs">
          {info.map(({ icon: Icon, text }) => (
            <p key={text} className="flex items-center gap-2">
              <Icon className="size-4 shrink-0" />
              {text}
            </p>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-maroon/10 pt-3">
          <span
            className={cn(
              'text-base font-bold',
              event.price === 'Gratuito' ? 'text-success-foreground' : 'text-maroon',
            )}
          >
            {event.price}
          </span>
          <Link to={href} aria-label={`Ver detalhes do ${shortName(event)}`} className="text-maroon">
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
