import useEmblaCarousel from 'embla-carousel-react'
import type { UseEmblaCarouselType } from 'embla-carousel-react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
}: Readonly<ComponentProps<'section'> & { opts?: CarouselOptions; plugins?: CarouselPlugins }>) {
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
    (event: KeyboardEvent<HTMLElement>) => {
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

  const context = useMemo(
    () => ({ carouselRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext }),
    [carouselRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext],
  )

  // <section> com nome acessível (aria-label/aria-labelledby vindo de quem usa) já tem o papel "region"
  return (
    <CarouselContext.Provider value={context}>
      <section
        onKeyDownCapture={handleKeyDown}
        className={cn('relative', className)}
        aria-roledescription="carrossel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </section>
    </CarouselContext.Provider>
  )
}

export function CarouselContent({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  const { carouselRef } = useCarousel()
  return (
    <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
      <div className={cn('-ml-4 flex', className)} {...props} />
    </div>
  )
}

export function CarouselItem({ className, ...props }: Readonly<ComponentProps<'div'>>) {
  return (
    // Padrão de carrossel do WAI-ARIA APG: cada slide é role="group" + aria-roledescription. Não há
    // elemento nativo equivalente (<fieldset> é para campos de formulário, <details> é expansível).
    <div
      role="group" // NOSONAR: typescript:S6819 — ver comentário acima
      aria-roledescription="item"
      data-slot="carousel-item"
      className={cn('min-w-0 shrink-0 grow-0 basis-full pl-4', className)}
      {...props}
    />
  )
}

export function CarouselPrevious(props: Readonly<ComponentProps<typeof Button>>) {
  const { scrollPrev, canScrollPrev } = useCarousel()
  return (
    <Button variant="outline" size="icon" disabled={!canScrollPrev} onClick={scrollPrev} {...props}>
      <ArrowLeft />
      <span className="sr-only">Anterior</span>
    </Button>
  )
}

export function CarouselNext(props: Readonly<ComponentProps<typeof Button>>) {
  const { scrollNext, canScrollNext } = useCarousel()
  return (
    <Button variant="outline" size="icon" disabled={!canScrollNext} onClick={scrollNext} {...props}>
      <ArrowRight />
      <span className="sr-only">Próximo</span>
    </Button>
  )
}
