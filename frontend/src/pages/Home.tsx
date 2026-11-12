import { LocateFixed } from 'lucide-react'
import CategoryList from '@/components/common/CategoryList'
import DemoNote from '@/components/common/DemoNote'
import SectionHeading from '@/components/common/SectionHeading'
import EventCard from '@/components/events/EventCard'
import EventSort from '@/components/events/EventSort'
import FeaturedCarousel from '@/components/events/FeaturedCarousel'
import { Button } from '@/components/ui/button'
import { useCatalogEvents } from '@/hooks/useCatalogEvents'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { logDemoAction } from '@/lib/demo'

export default function Home() {
  useDocumentTitle('CultHub | Explore São Paulo')
  const { events, count, hasMore, loading, error, retry, loadMore } = useCatalogEvents()
  const featured = events.slice(0, 8)

  return (
    <div className="space-y-12 max-sm:space-y-[34px]">
      <section aria-labelledby="mapa-titulo">
        <SectionHeading
          as="h1"
          id="mapa-titulo"
          title="Mapa de Eventos"
          description="Explore atividades e shows acontecendo ao seu redor em São Paulo"
        >
          <div className="max-w-[245px] text-right max-sm:max-w-none max-sm:text-left">
            <Button
              variant="outline"
              aria-describedby="localizacao-aviso"
              onClick={() => logDemoAction('Pedir localização do usuário')}
              className="max-sm:min-h-10 max-sm:px-[14px] max-sm:py-[9px]"
            >
              <LocateFixed />
              Minha Localização
            </Button>
            <DemoNote id="localizacao-aviso" className="mt-[5px]">
              Mapa ilustrativo. Nesta demonstração, o pedido de localização só aparece no console.
            </DemoNote>
          </div>
        </SectionHeading>

        <figure>
          <img
            className="block w-full rounded-[26px] border border-line max-sm:rounded-2xl"
            src="/assets/mapa-eventos.png"
            width={1280}
            height={450}
            alt="Mapa ilustrativo de São Paulo com marcadores de eventos culturais. Os elementos representados na imagem não são interativos."
          />
          <figcaption className="mt-[14px] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-sm:gap-[10px]">
            <CategoryList
              aria-label="Legenda de categorias"
              className="gap-[22px] text-[11px] font-semibold max-md:gap-4 max-sm:gap-x-[14px] max-sm:gap-y-[10px] max-sm:text-[10px]"
            />
            <DemoNote className="max-sm:text-[10px]">
              Imagem estática de referência, sem navegação ou localização em tempo real.
            </DemoNote>
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="destaques-titulo">
        <FeaturedCarousel events={featured} titleId="destaques-titulo" />
      </section>

      <section aria-labelledby="eventos-titulo">
        <SectionHeading
          id="eventos-titulo"
          title="Todos os Eventos Encontrados"
          description={
            loading && events.length === 0
              ? 'Carregando eventos...'
              : `Exibindo ${events.length} de ${count} evento(s) encontrado(s)`
          }
        >
          <EventSort />
        </SectionHeading>

        {error && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 mb-5 rounded-2xl border p-4">
            <p>{error}</p>
            <Button variant="outline" onClick={retry} className="mt-3">
              Tentar novamente
            </Button>
          </div>
        )}

        {loading && events.length === 0 && (
          <p role="status" className="mb-5 text-sm text-muted-foreground">
            Buscando eventos no catálogo...
          </p>
        )}

        <div className="grid grid-cols-3 gap-6 max-lg:gap-[18px] max-md:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-5">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        {!loading && !error && events.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted-foreground">
            Nenhum evento disponível no catálogo no momento.
          </p>
        )}

        {hasMore && (
          <div className="mt-6 text-center">
            <Button onClick={loadMore} disabled={loading} variant="outline">
              {loading ? 'Carregando...' : 'Carregar mais eventos'}
            </Button>
          </div>
        )}

        <DemoNote className="mt-5">
          A lista e a contagem vêm do catálogo do CultHub. Busca, filtros e ordenação ainda são
          demonstrativos. Os links dos cards abrem a página oficial do evento quando disponível.
        </DemoNote>
      </section>
    </div>
  )
}
