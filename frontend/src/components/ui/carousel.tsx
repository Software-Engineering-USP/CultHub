import useEmblaCarousel from 'embla-carousel-react'
import type { UseEmblaCarouselType } from 'embla-carousel-react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ComponentProps, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add carousel), só horizontal e com textos em português.

type CarouselApi = UseEmblaCarouselType[1]
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0]
type CarouselPlugins = Parameters<typeof useEmblaCarousel>[1]

interface CarouselContextValue {
  carouselRef: UseEmblaCarouselType[0]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
}

const CarouselContext = createContext<CarouselContextValue | null>(null)

function useCarousel() {
  const context = useContext(CarouselContext)
  if (!context) throw new Error('useCarousel deve ser usado dentro de <Carousel />')
  return context
}

export function Carousel({
  opts,
  plugins,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { opts?: CarouselOptions; plugins?: CarouselPlugins }) {
  const [carouselRef, api] = useEmblaCarousel(opts, plugins)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const onSelect = useCallback((api: CarouselApi) => {
    if (!api) return
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api])
  const scrollNext = useCallback(() => api?.scrollNext(), [api])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext],
  )

  useEffect(() => {
    if (!api) return
    // Estado inicial no próximo frame (evita setState síncrono dentro do efeito)
    const frame = requestAnimationFrame(() => onSelect(api))
    api.on('reInit', onSelect)
    api.on('select', onSelect)
    return () => {
      cancelAnimationFrame(frame)
      api.off('reInit', onSelect)
      api.off('select', onSelect)
    }
  }, [api, onSelect])

  return (
    <CarouselContext.Provider value={{ carouselRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}>
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn('relative', className)}
        role="region"
        aria-roledescription="carrossel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

export function CarouselContent({ className, ...props }: ComponentProps<'div'>) {
  const { carouselRef } = useCarousel()
  return (
    <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
      <div className={cn('-ml-4 flex', className)} {...props} />
    </div>
  )
}

export function CarouselItem({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      aria-roledescription="item"
      data-slot="carousel-item"
      className={cn('min-w-0 shrink-0 grow-0 basis-full pl-4', className)}
      {...props}
    />
  )
}

export function CarouselPrevious(props: ComponentProps<typeof Button>) {
  const { scrollPrev, canScrollPrev } = useCarousel()
  return (
    <Button variant="outline" size="icon" disabled={!canScrollPrev} onClick={scrollPrev} {...props}>
      <ArrowLeft />
      <span className="sr-only">Anterior</span>
    </Button>
  )
}

export function CarouselNext(props: ComponentProps<typeof Button>) {
  const { scrollNext, canScrollNext } = useCarousel()
  return (
    <Button variant="outline" size="icon" disabled={!canScrollNext} onClick={scrollNext} {...props}>
      <ArrowRight />
      <span className="sr-only">Próximo</span>
    </Button>
  )
}
