import { ArrowRight, LocateFixed } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import DemoNote from '@/components/common/DemoNote'
import Field from '@/components/common/Field'
import IconTile from '@/components/common/IconTile'
import StaticMap from '@/components/common/StaticMap'
import PlanVisitLayout, { PlanVisitPanel } from '@/components/events/PlanVisitLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRouteOptions } from '@/hooks/useRouteOptions'
import { peerFocusRing } from '@/lib/classes'
import { logDemoAction } from '@/lib/demo'
import { onFormSubmit, text } from '@/lib/forms'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { api } from '@/services/api'
import type { EventWithDetails, RouteOption } from '@/types'

export default function Origin({ event }: { event: EventWithDetails }) {
  const navigate = useNavigate()
  const routeOptions = useRouteOptions(event.id)
  useDocumentTitle('Defina sua origem | CultHub')

  return (
    <PlanVisitLayout
      event={event}
      description="Seu próximo encontro com a música começa com um ponto de partida."
      status={
        <Badge variant="muted" size="md">
          <LocateFixed className="size-3.5" />
          Defina sua origem para começar
        </Badge>
      }
      map={
        <StaticMap
          src="/assets/mapa-origem.png"
          width={856}
          height={690}
          alt="Mapa ilustrativo da região do Ibirapuera na tela de definição da origem, sem ponto de partida real. Os controles desenhados fazem parte da imagem e não são interativos."
          caption="Mapa estático do layout de referência. Origem não definida; não é um serviço de mapas ou navegação."
        />
      }
    >
      <PlanVisitPanel aria-labelledby="origem-titulo">
        <div className="mb-5 flex items-center gap-3">
          <IconTile icon={LocateFixed} />
          <h2 id="origem-titulo" className="text-xl max-sm:text-lg">
            De onde você vai sair?
          </h2>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-accent px-4 py-3.5">
          <strong className="mb-1.5 block text-xs text-maroon">Localização indisponível</strong>
          <p className="text-xs">
            Não temos sua localização. Você pode permitir o uso para definir a origem ou informar um endereço,
            como preferir.
          </p>
        </div>

        <Button
          block
          aria-describedby="geolocalizacao-aviso"
          onClick={() => logDemoAction('Pedir localização do usuário')}
        >
          <LocateFixed />
          Usar minha localização (demo)
        </Button>
        <DemoNote id="geolocalizacao-aviso" size="xs" className="mt-2.5">
          Demonstração: o pedido só aparece no console; nenhuma localização é solicitada ou coletada.
        </DemoNote>

        <div className="my-4 flex items-center gap-2.5 text-2xs text-muted-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
          ou informe a partida
        </div>

        <form
          aria-label="Definir partida (demonstração)"
          aria-describedby="planejamento-aviso"
          autoComplete="off"
          onSubmit={onFormSubmit(async (data) => {
            await api.routes.plan({
              eventId: event.id,
              origin: text(data, 'endereco'),
              mode: text(data, 'transporte') as RouteOption['id'],
            })
            navigate(paths.eventRoute(event.id))
          })}
        >
          <Field
            id="endereco"
            required
            name="endereco"
            label="Endereço de partida"
            type="text"
            placeholder="Digite um endereço de partida"
            autoComplete="off"
            help="Informe rua, número e cidade. Use apenas um endereço fictício neste exemplo."
          />

          <div className="my-4 rounded-xl border border-border bg-background px-4 py-3">
            <small className="block text-2xs text-muted-foreground">Destino</small>
            <strong className="text-xs">{event.venue}</strong>
          </div>

          <fieldset aria-describedby="transporte-aviso" className="mb-4.5 min-w-0">
            <legend className="mb-2 text-xs font-semibold">Como você quer ir?</legend>
            <div className="grid grid-cols-3 gap-2">
              {routeOptions.map((route) => (
                <div key={route.id} className="relative">
                  <input
                    id={route.id}
                    name="transporte"
                    type="radio"
                    value={route.id}
                    defaultChecked={route.id === 'carro'}
                    className="peer absolute top-3 left-2.5 mt-0.5 size-3 accent-maroon"
                  />
                  <label
                    htmlFor={route.id}
                    className={cn(
                      'block rounded-xl border border-border bg-card py-2.5 pr-2 pl-7 text-center text-2xs peer-checked:border-sun/70 peer-checked:bg-primary/30 peer-checked:font-bold peer-checked:text-maroon max-md:text-xs max-sm:text-2xs',
                      peerFocusRing,
                    )}
                  >
                    {route.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <DemoNote id="transporte-aviso" size="xs" className="mt-2.5 mb-3.5">
            A escolha é apenas visual e não altera o mapa.
          </DemoNote>

          <Button type="submit" block>
            Traçar rota <ArrowRight />
          </Button>
          <DemoNote id="planejamento-aviso" size="xs" className="mt-2.5">
            Demonstração: o pedido de rota só aparece no console e abre a rota de exemplo. Nenhum endereço é
            enviado.
          </DemoNote>
        </form>

        <Button asChild variant="link" className="mt-4 flex">
          <Link to={paths.eventRoute(event.id)}>
            Ver rota de exemplo <ArrowRight />
          </Link>
        </Button>

        <DemoNote size="xs" className="mt-4.5 border-t border-border pt-4">
          Sua localização só deverá ser usada com seu consentimento em uma versão integrada. Aqui não há
          geolocalização, consulta de endereços ou armazenamento de dados.
        </DemoNote>
      </PlanVisitPanel>
    </PlanVisitLayout>
  )
}
