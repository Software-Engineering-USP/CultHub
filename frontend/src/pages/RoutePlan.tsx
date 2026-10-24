import { Link } from 'react-router-dom'
import EventStrip from '../components/events/EventStrip'
import BackLink from '../components/ui/BackLink'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import { Button } from '../components/ui/Button'
import DemoNote from '../components/ui/DemoNote'
import Eyebrow from '../components/ui/Eyebrow'
import NotFound from '../components/ui/NotFound'
import SectionHeading from '../components/ui/SectionHeading'
import StatusBadge from '../components/ui/StatusBadge'
import Surface from '../components/ui/Surface'
import WeatherStrip from '../components/weather/WeatherStrip'
import { demoRoutes } from '../data/events'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEvent } from '../hooks/useEvent'
import { cn } from '../lib/cn'

const dotBase =
  "relative pl-[22px] before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:border-2 before:border-maroon before:content-['']"

export default function RoutePlan() {
  const event = useEvent()
  useDocumentTitle('Rota de exemplo | CultHub')

  if (!event?.details) {
    return <NotFound message="Não encontramos o evento para exibir a rota." />
  }

  const base = `/eventos/${event.id}`
  const selected = demoRoutes[0]
  const itinerary = [
    { title: 'Parta da origem fictícia', detail: 'Ponto indicado no mapa.' },
    { title: 'Siga o trajeto destacado', detail: 'Percurso ilustrativo, sem vias confirmadas.' },
    { title: `Chegue ao ${event.venue}`, detail: 'Confirme o acesso nos canais do local.' },
  ]

  return (
    <>
      <BackLink to={base}>← Voltar para o evento</BackLink>
      <Breadcrumbs
        items={[
          { label: 'Explorar', to: '/' },
          { label: event.shortTitle ?? event.title, to: base },
          { label: 'Como chegar' },
        ]}
      />

      <SectionHeading
        as="h1"
        variant="page"
        title="Como chegar"
        description="Planeje seu caminho até a música. Compare as opções neste trajeto demonstrativo."
      >
        <StatusBadge>Rota ilustrativa • origem fictícia</StatusBadge>
      </SectionHeading>

      <EventStrip event={event} />

      <div className="grid grid-cols-[minmax(300px,400fr)_minmax(0,856fr)] items-start gap-6 max-lg:grid-cols-[minmax(300px,.9fr)_minmax(0,1.5fr)] max-md:grid-cols-[minmax(0,1fr)]">
        <Surface
          as="section"
          aria-labelledby="trajeto-titulo"
          bg="bg-[#f9eddb]"
          padded={false}
          className="p-6 max-md:p-7 max-sm:p-[21px]"
        >
          <div className="mb-5 flex items-start justify-between gap-[14px]">
            <h2 id="trajeto-titulo" className="text-[21px]">
              Seu trajeto
            </h2>
            <Eyebrow tight className="max-w-[85px] text-right text-[8px] text-muted">
              EXEMPLO ILUSTRATIVO
            </Eyebrow>
          </div>

          <div className="mb-[22px] grid gap-4">
            <div className={dotBase}>
              <Link to={`${base}/origem`} className="float-right text-[10px] text-maroon underline">
                Alterar
              </Link>
              <small className="block text-[10px] text-muted">Partida</small>
              <strong className="block text-[12px]">Sua localização • exemplo</strong>
            </div>
            <div className={cn(dotBase, 'before:bg-maroon')}>
              <small className="block text-[10px] text-muted">Destino</small>
              <strong className="block text-[12px]">{event.venue}</strong>
            </div>
          </div>

          <ul
            aria-label="Comparação ilustrativa de transportes, sem seleção interativa"
            className="mb-[22px] grid grid-cols-3 gap-2"
          >
            {demoRoutes.map((route, index) => (
              <li
                key={route.id}
                className={cn(
                  'rounded-xl border px-[5px] py-3 text-center max-md:px-[10px] max-md:py-[14px]',
                  index === 0 ? 'border-[#b97e42] bg-[#ffdfb2]' : 'border-line bg-surface',
                )}
              >
                <strong className="block text-[10px]">{route.label}</strong>
                <span className="mt-1 block text-[17px] font-[750] text-maroon">{route.time}</span>
                <small className="block text-[9px] text-muted">
                  {route.detail}
                  {index === 0 && ' • em destaque'}
                </small>
              </li>
            ))}
          </ul>

          <div className="mb-[23px] flex items-center justify-between gap-[14px] border-t border-[#e5d5bc] pt-[19px]">
            <div>
              <strong className="block text-[29px] leading-[1.2] tracking-[-.05em] text-maroon">
                {selected.time}
              </strong>
              <small className="text-[10px]">{selected.detail} • de carro</small>
            </div>
            <span className="max-w-[90px] rounded-lg bg-[#eee3cf] px-2 py-[5px] text-center text-[9px] text-[#67503a]">
              Mais rápido no exemplo
            </span>
          </div>

          <div>
            <h3 className="text-[13px]">Itinerário demonstrativo</h3>
            <ol className="mb-[22px] mt-4">
              {itinerary.map((step, index) => (
                <li key={step.title} className="relative pb-[19px] pl-8 text-[11px] last:pb-0">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-px grid h-[22px] w-[22px] place-items-center rounded-full bg-[#ede0c9] text-[10px] font-bold text-maroon"
                  >
                    {index + 1}
                  </span>
                  <strong className="block">{step.title}</strong>
                  <span className="mt-1 block text-[10px] text-muted">{step.detail}</span>
                </li>
              ))}
            </ol>
          </div>

          <Button block disabled aria-describedby="navegacao-aviso">
            Abrir no app de mapas <span aria-hidden="true">↗</span>
          </Button>
          <DemoNote id="navegacao-aviso" size="xs" className="mt-[10px]">
            Navegação real exige um serviço externo e consentimento de localização. Este botão é apenas
            visual; nenhuma ação é executada.
          </DemoNote>

          <DemoNote size="xs" className="mt-[18px] border-t border-line pt-[15px]">
            Origem, distâncias e tempos são fictícios. Não há consulta de trânsito, cálculo de percurso ou
            compartilhamento de localização. <Link to={`${base}/origem`}>Voltar à definição de origem</Link>.
          </DemoNote>
        </Surface>

        <figure>
          <img
            className="block w-full rounded-3xl border border-line"
            src="/assets/mapa-rota.png"
            width={856}
            height={690}
            alt="Mapa ilustrativo de uma rota destacada entre uma origem fictícia e o destino. O percurso e os controles desenhados são estáticos, sem navegação real."
          />
          <DemoNote as="figcaption" className="mt-[10px]">
            Imagem estática do trajeto de exemplo. Não use este mapa para navegação: confirme o percurso em
            um serviço de mapas atualizado.
          </DemoNote>
        </figure>
      </div>

      <WeatherStrip event={event} />
    </>
  )
}
