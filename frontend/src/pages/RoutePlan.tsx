import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import DemoNote from '@/components/common/DemoNote'
import Eyebrow from '@/components/common/Eyebrow'
import StaticMap from '@/components/common/StaticMap'
import PlanVisitLayout, { PlanVisitPanel } from '@/components/events/PlanVisitLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRouteOptions } from '@/hooks/useRouteOptions'
import { logDemoAction } from '@/lib/demo'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { EventWithDetails } from '@/types'

const dotBase =
  "relative pl-5.5 before:absolute before:top-2 before:left-0 before:size-2 before:rounded-full before:border-2 before:border-maroon before:content-['']"

export default function RoutePlan({ event }: { event: EventWithDetails }) {
  const routeOptions = useRouteOptions(event.id)
  useDocumentTitle('Rota de exemplo | CultHub')

  const selected = routeOptions[0]
  const itinerary = [
    { title: 'Parta da origem fictícia', detail: 'Ponto indicado no mapa.' },
    { title: 'Siga o trajeto destacado', detail: 'Percurso ilustrativo, sem vias confirmadas.' },
    { title: `Chegue ao ${event.venue}`, detail: 'Confirme o acesso nos canais do local.' },
  ]

  return (
    <PlanVisitLayout
      event={event}
      description="Planeje seu caminho até a música. Compare as opções neste trajeto demonstrativo."
      status={
        <Badge variant="muted" size="md">
          Rota ilustrativa • origem fictícia
        </Badge>
      }
      map={
        <StaticMap
          src="/assets/mapa-rota.png"
          width={856}
          height={690}
          alt="Mapa ilustrativo de uma rota destacada entre uma origem fictícia e o destino. O percurso e os controles desenhados são estáticos, sem navegação real."
          caption="Imagem estática do trajeto de exemplo. Não use este mapa para navegação: confirme o percurso em um serviço de mapas atualizado."
        />
      }
    >
      <PlanVisitPanel aria-labelledby="trajeto-titulo" className="bg-cream">
        <div className="mb-5 flex items-start justify-between gap-3.5">
          <h2 id="trajeto-titulo" className="text-xl">
            Seu trajeto
          </h2>
          <Eyebrow className="max-w-24 text-right text-2xs text-muted-foreground">
            EXEMPLO ILUSTRATIVO
          </Eyebrow>
        </div>

        <div className="mb-5.5 grid gap-4">
          <div className={dotBase}>
            <Link to={paths.eventOrigin(event.id)} className="float-right text-2xs text-maroon underline">
              Alterar
            </Link>
            <small className="block text-2xs text-muted-foreground">Partida</small>
            <strong className="block text-xs">Sua localização • exemplo</strong>
          </div>
          <div className={cn(dotBase, 'before:bg-maroon')}>
            <small className="block text-2xs text-muted-foreground">Destino</small>
            <strong className="block text-xs">{event.venue}</strong>
          </div>
        </div>

        <ul
          aria-label="Comparação ilustrativa de transportes, sem seleção interativa"
          className="mb-5.5 grid grid-cols-3 gap-2"
        >
          {routeOptions.map((route, index) => (
            <li
              key={route.id}
              className={cn(
                'rounded-xl border px-1 py-3 text-center max-md:px-2.5 max-md:py-3.5',
                index === 0 ? 'border-sun/70 bg-primary/30' : 'border-border bg-card',
              )}
            >
              <strong className="block text-2xs">{route.label}</strong>
              <span className="mt-1 block text-lg font-bold text-maroon">{route.time}</span>
              <small className="block text-2xs text-muted-foreground">
                {route.detail}
                {index === 0 && ' • em destaque'}
              </small>
            </li>
          ))}
        </ul>

        <div className="mb-6 flex items-center justify-between gap-3.5 border-t border-maroon/10 pt-5">
          <div>
            <strong className="block text-3xl tracking-tighter text-maroon">{selected.time}</strong>
            <small className="text-2xs">{selected.detail} • de carro</small>
          </div>
          <span className="max-w-24 rounded-lg bg-muted px-2 py-1 text-center text-2xs text-muted-foreground">
            Mais rápido no exemplo
          </span>
        </div>

        <div>
          <h3 className="text-sm">Itinerário demonstrativo</h3>
          <ol className="mt-4 mb-5.5">
            {itinerary.map((step, index) => (
              <li key={step.title} className="relative pb-5 pl-8 text-xs last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute top-px left-0 grid size-5.5 place-items-center rounded-full bg-muted text-2xs font-bold text-maroon"
                >
                  {index + 1}
                </span>
                <strong className="block">{step.title}</strong>
                <span className="mt-1 block text-2xs text-muted-foreground">{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>

        <Button
          block
          aria-describedby="navegacao-aviso"
          onClick={() => logDemoAction('Abrir rota no app de mapas', { eventId: event.id })}
        >
          Abrir no app de mapas <ArrowUpRight />
        </Button>
        <DemoNote id="navegacao-aviso" size="xs" className="mt-2.5">
          Navegação real exige um serviço externo e consentimento de localização. Nesta demonstração, o botão
          só registra a ação no console.
        </DemoNote>

        <DemoNote size="xs" className="mt-4.5 border-t border-border pt-4">
          Origem, distâncias e tempos são fictícios. Não há consulta de trânsito, cálculo de percurso ou
          compartilhamento de localização.{' '}
          <Link to={paths.eventOrigin(event.id)}>Voltar à definição de origem</Link>.
        </DemoNote>
      </PlanVisitPanel>
    </PlanVisitLayout>
  )
}
