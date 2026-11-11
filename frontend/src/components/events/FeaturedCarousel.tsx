import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import { ArrowRight } from 'lucide-react'
import SectionHeading from '@/components/common/SectionHeading'
import EventCard from '@/components/events/EventCard'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import type { CultEvent } from '@/types'

const plugins = [WheelGesturesPlugin()]

interface FeaturedCarouselProps {
  events: CultEvent[]
  /** id do título, para a <section> da página usar em aria-labelledby */
  titleId: string
}

/** Próximos eventos da Home, com controles de navegação do carrossel. */
export default function FeaturedCarousel({ events, titleId }: Readonly<FeaturedCarouselProps>) {
  const label = `${events.length} próximos eventos`

  return (
    <Carousel opts={{ align: 'start' }} plugins={plugins} aria-label={label}>
      <SectionHeading
        id={titleId}
        title="Próximos eventos"
        description="Alguns dos próximos eventos cadastrados no catálogo"
      >
        <div className="flex gap-2">
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </SectionHeading>

      <CarouselContent className="-ml-5 pb-4">
        {events.map((event, index) => (
          <CarouselItem key={event.id} className="basis-87.5 pl-5 max-sm:basis-[min(310px,85%)]">
            <EventCard event={event} priority={index === 0} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="inline-flex items-center gap-1">
          Deslize para descobrir mais <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Carousel>
  )
}
