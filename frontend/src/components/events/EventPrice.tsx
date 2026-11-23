import { ExternalLink } from 'lucide-react'
import type { CultEvent } from '@/types'

interface EventPriceProps {
  event: CultEvent
  className?: string
  block?: boolean
}

/** Mostra o preço cadastrado ou direciona para a página oficial quando desconhecido. */
export default function EventPrice({ event, className = '', block = false }: Readonly<EventPriceProps>) {
  if (event.price === 'Preço não informado' && event.officialUrl) {
    return (
      <a
        href={event.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Link oficial para ${event.title}`}
        className={`${block ? 'flex w-fit' : 'inline-flex'} items-center gap-1.5 font-semibold text-maroon underline underline-offset-4 ${className}`}
      >
        Link oficial <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
      </a>
    )
  }

  return <span className={className}>{event.price}</span>
}
