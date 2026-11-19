import { LocateFixed } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CategoryList from '@/components/common/CategoryList'
import SectionHeading from '@/components/common/SectionHeading'
import EventCard from '@/components/events/EventCard'
import FeaturedCarousel from '@/components/events/FeaturedCarousel'
import { Button } from '@/components/ui/button'
import { useCatalog } from '@/hooks/useCatalog'
import { useDeviceLocation } from '@/hooks/useDeviceLocation'
import type { LocationStatus } from '@/hooks/useDeviceLocation'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { categoryOrder } from '@/lib/categories'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CatalogQuery } from '@/services/catalog'

// O Leaflet (~150 kB) fica fora do arquivo principal: a Home aparece antes e o mapa chega logo depois.
const EventsMap = lazy(() => import('@/components/map/EventsMap'))

const mapBox = 'h-112.5 w-full rounded-3xl border border-border max-sm:h-85 max-sm:rounded-2xl'

const locationMessages: Partial<Record<LocationStatus, string>> = {
  locating: 'Obtendo sua localização…',
  denied: 'Você não permitiu o uso da localização. O mapa continua no centro de São Paulo.',
  unavailable: 'Não conseguimos obter sua localização agora.',
}

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const myLocation = useDeviceLocation()
  const [recenter, setRecenter] = useState(0)
  const categoryValues = searchParams.get('categorias')?.split(',') ?? []
  const categories = categoryValues.filter((value): value is (typeof categoryOrder)[number] =>
    categoryOrder.includes(value as (typeof categoryOrder)[number]),
  )
  const query: CatalogQuery = {
    q: searchParams.get('q') || undefined,
    categorias: categories.length ? categories : undefined,
    preco: (['gratuito', 'pago', 'desconhecido'] as const).find(
      (value) => value === searchParams.get('preco'),
    ),
    de: searchParams.get('de') ?? undefined,
    ate: searchParams.get('ate') ?? undefined,
  }
  const { events, count, loading, error, hasMore, loadMore } = useCatalog(query)
  useDocumentTitle('CultHub | Explore São Paulo')
  const featured = events.slice(0, 5)
  const pinned = events.filter((event) => event.location).length

  // Cada clique pede a posição atual, mesmo se já houver uma posição em cache.
  function locate() {
    setRecenter((value) => value + 1)
    myLocation.request()
  }

  return (
    <div className="space-y-12 max-sm:space-y-8.5">
      <section aria-labelledby="mapa-titulo">
        <SectionHeading
          as="h1"
          id="mapa-titulo"
          title="Mapa de Eventos"
          description="Explore atividades e shows acontecendo ao seu redor em São Paulo"
        >
          <div className="max-w-61 text-right max-sm:max-w-none max-sm:text-left">
            <Button
              variant="outline"
              disabled={myLocation.status === 'locating'}
              onClick={locate}
              className="max-sm:min-h-10 max-sm:px-3.5 max-sm:py-2"
            >
              <LocateFixed />
              Minha Localização
            </Button>
            <p aria-live="polite" className="mt-1 text-2xs text-muted-foreground">
              {locationMessages[myLocation.status]}
            </p>
          </div>
        </SectionHeading>

        <figure>
          <Suspense fallback={<div aria-hidden="true" className={cn(mapBox, 'bg-muted')} />}>
            <EventsMap
              events={events}
              userPosition={myLocation.position}
              recenter={recenter}
              onSelect={(id) => navigate(paths.event(id))}
              className={mapBox}
            />
          </Suspense>
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-sm:gap-2.5">
            <CategoryList
              aria-label="Legenda de categorias"
              className="gap-5.5 text-xs font-semibold max-md:gap-4 max-sm:gap-x-3.5 max-sm:gap-y-2.5 max-sm:text-2xs"
            />
            <p className="text-2xs text-muted-foreground">
              {pinned === 1
                ? '1 evento da lista abaixo está no mapa.'
                : `${pinned} eventos da lista abaixo estão no mapa.`}
            </p>
          </figcaption>
        </figure>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="proximos-eventos-titulo">
          <FeaturedCarousel events={featured} titleId="proximos-eventos-titulo" />
        </section>
      )}

      <section aria-labelledby="eventos-titulo">
        <SectionHeading
          id="eventos-titulo"
          title="Todos os Eventos Encontrados"
          description={
            loading && events.length === 0
              ? 'Carregando eventos…'
              : `Exibindo ${events.length} de ${count} evento(s)`
          }
        >
          <span className="text-xs text-muted-foreground">Ordenados por data</span>
        </SectionHeading>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            {error}
          </p>
        )}
        <div className="grid grid-cols-3 gap-6 max-lg:gap-4.5 max-md:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-5">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        {!loading && events.length === 0 && !error && (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum evento encontrado com esses filtros.
          </p>
        )}
        {loading && events.length === 0 && (
          <output className="py-8 text-center text-muted-foreground">Carregando eventos…</output>
        )}
        {hasMore && (
          <div className="mt-6 text-center">
            <Button variant="outline" disabled={loading} onClick={loadMore}>
              {loading ? 'Carregando…' : 'Carregar mais eventos'}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
