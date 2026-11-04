import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
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

/** Carrossel horizontal dos eventos em destaque (Home). */
export default function FeaturedCarousel({ events }: { events: CultEvent[] }) {
  const label = `${events.length} experiências em destaque`

  return (
    <Carousel opts={{ align: 'start' }} plugins={plugins} aria-label={label}>
      <CarouselContent className="-ml-5 pb-4">
        {events.map((event, index) => (
          <CarouselItem
            key={event.id}
            className="basis-[350px] pl-5 max-sm:basis-[min(310px,85%)] [&>article]:h-full"
          >
            <EventCard event={event} priority={index === 0} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>{label}</span>
        <div className="flex gap-2">
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </div>
    </Carousel>
  )
}
