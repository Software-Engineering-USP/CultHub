import EventCard from '../components/events/EventCard'
import { Button } from '../components/ui/Button'
import CategoryDot from '../components/ui/CategoryDot'
import DemoNote from '../components/ui/DemoNote'
import Eyebrow from '../components/ui/Eyebrow'
import SectionHeading from '../components/ui/SectionHeading'
import { events } from '../data/events'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { categories, categoryOrder } from '../lib/categories'

export default function Home() {
  useDocumentTitle('CultHub | Explore São Paulo')
  const featured = events.filter((event) => event.featured)

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
              variant="secondary"
              disabled
              aria-describedby="localizacao-aviso"
              className="max-sm:min-h-10 max-sm:px-[14px] max-sm:py-[9px]"
            >
              ◎ Minha Localização
            </Button>
            <DemoNote id="localizacao-aviso" className="mt-[5px]">
              Mapa ilustrativo. Localização não disponível nesta demonstração.
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
            <ul
              aria-label="Legenda de categorias"
              className="flex flex-wrap gap-[22px] text-[11px] font-semibold max-md:gap-4 max-sm:gap-x-[14px] max-sm:gap-y-[10px] max-sm:text-[10px]"
            >
              {categoryOrder.map((id) => (
                <li key={id}>
                  <CategoryDot id={id} />
                  {categories[id].label}
                </li>
              ))}
            </ul>
            <DemoNote className="max-sm:text-[10px]">
              Imagem estática de referência, sem navegação ou localização em tempo real.
            </DemoNote>
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="destaques-titulo">
        <SectionHeading
          id="destaques-titulo"
          title="Eventos em Destaque"
          description="As experiências mais recomendadas da semana"
        >
          <Eyebrow className="text-[10px] text-muted">SEU PRÓXIMO ENCONTRO COM A CIDADE</Eyebrow>
        </SectionHeading>

        <div
          tabIndex={0}
          role="region"
          aria-label={`${featured.length} experiências em destaque, role horizontalmente para explorar`}
          className="grid snap-x snap-proximity scrollbar-thin [scrollbar-color:#c2a789_transparent] auto-cols-[350px] grid-flow-col gap-5 overflow-x-auto px-[2px] pb-4 *:snap-start max-sm:auto-cols-[min(310px,85vw)] max-sm:gap-[15px]"
        >
          {featured.map((event, index) => (
            <EventCard key={event.id} event={event} priority={index === 0} />
          ))}
        </div>

        <div className="mt-[7px] flex justify-between gap-4 text-[11px] text-muted max-sm:flex-wrap max-sm:gap-[6px] max-sm:text-[10px]">
          <span>{featured.length} experiências em destaque</span>
          <span>Deslize para descobrir mais →</span>
        </div>
      </section>

      <section aria-labelledby="eventos-titulo">
        <SectionHeading
          id="eventos-titulo"
          title="Todos os Eventos Encontrados"
          description={`Exibindo ${events.length} evento(s) encontrado(s)`}
        >
          <span className="rounded-xl border border-line bg-surface/65 px-4 py-[10px] text-[12px] whitespace-nowrap max-sm:text-[11px]">
            Ordenar: <strong>Relevância</strong> <span className="text-muted">· exemplo fixo</span>
          </span>
        </SectionHeading>

        <div className="grid grid-cols-3 gap-6 max-lg:gap-[18px] max-md:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-5">
          {events.map((event) => (
            <EventCard key={event.id} event={event} icons />
          ))}
        </div>

        <DemoNote className="mt-5">
          Busca, filtros e ordenação são demonstrativos. Apenas o Jazz &amp; Blues Festival possui uma página
          de detalhes neste exemplo.
        </DemoNote>
      </section>
    </div>
  )
}
