import { LocateFixed } from 'lucide-react'
import CategoryList from '@/components/common/CategoryList'
import DemoNote from '@/components/common/DemoNote'
import SectionHeading from '@/components/common/SectionHeading'
import EventCard from '@/components/events/EventCard'
import EventSort from '@/components/events/EventSort'
import FeaturedCarousel from '@/components/events/FeaturedCarousel'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEvents } from '@/hooks/useEvents'
import { logDemoAction } from '@/lib/demo'

export default function Home() {
  useDocumentTitle('CultHub | Explore São Paulo')
  const events = useEvents()
  const featured = events.filter((event) => event.featured)

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
              aria-describedby="localizacao-aviso"
              onClick={() => logDemoAction('Pedir localização do usuário')}
              className="max-sm:min-h-10 max-sm:px-3.5 max-sm:py-2"
            >
              <LocateFixed />
              Minha Localização
            </Button>
            <DemoNote id="localizacao-aviso" className="mt-1">
              Mapa ilustrativo. Nesta demonstração, o pedido de localização só aparece no console.
            </DemoNote>
          </div>
        </SectionHeading>

        <figure>
          <iframe
            className="block h-112.5 w-full rounded-3xl border border-border max-sm:h-85 max-sm:rounded-2xl"
            title="Mapa OpenStreetMap de São Paulo"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-46.75%2C-23.65%2C-46.55%2C-23.48&layer=mapnik"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-sm:gap-2.5">
            <CategoryList
              aria-label="Legenda de categorias"
              className="gap-5.5 text-xs font-semibold max-md:gap-4 max-sm:gap-x-3.5 max-sm:gap-y-2.5 max-sm:text-2xs"
            />
            <DemoNote>
              Mapa © OpenStreetMap contributors. Os pins dos eventos serão adicionados depois.
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
          description={`Exibindo ${events.length} evento(s) encontrado(s)`}
        >
          <EventSort />
        </SectionHeading>

        <div className="grid grid-cols-3 gap-6 max-lg:gap-4.5 max-md:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-5">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>

        <DemoNote className="mt-5">
          Busca, filtros e ordenação são demonstrativos e só aparecem no console. Apenas o Jazz &amp; Blues
          Festival possui uma página de detalhes neste exemplo.
        </DemoNote>
      </section>
    </div>
  )
}
