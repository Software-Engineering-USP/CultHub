import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import DemoNote from '@/components/common/DemoNote'
import Eyebrow from '@/components/common/Eyebrow'
import Surface from '@/components/common/Surface'
import { Button } from '@/components/ui/button'
import { useRouteOptions } from '@/hooks/useRouteOptions'
import { paths } from '@/lib/paths'
import type { CultEvent } from '@/types'

/** Resumo de rotas na página do evento. */
export default function RoutePreview({ event }: Readonly<{ event: CultEvent }>) {
  const routeOptions = useRouteOptions(event.id)

  return (
    <Surface as="section" aria-labelledby="rota-titulo" className="bg-cream">
      <div className="flex items-center justify-between gap-3.5">
        <h3 id="rota-titulo" className="text-lg">
          Planejar rota
        </h3>
        <Eyebrow className="text-2xs text-muted-foreground">{event.details?.startTime} · EXEMPLO</Eyebrow>
      </div>
      <p className="mt-2 text-xs">De sua localização até o {event.venue}</p>

      <div className="my-5 grid gap-2.5">
        {routeOptions.map((route) => (
          <div
            key={route.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs"
          >
            <div>
              <strong className="block">{route.label}</strong>
              <span className="text-muted-foreground">
                {route.detail} • {route.tag}
              </span>
            </div>
            <div className="text-right text-base font-bold text-maroon">
              {route.time}
              <small className="block text-2xs font-medium text-muted-foreground">Tempo ilustrativo</small>
            </div>
          </div>
        ))}
      </div>

      <Button asChild block>
        <Link to={paths.eventRoute(event.id)} aria-label="Ver rota completa de exemplo">
          Ver rota completa <ArrowRight />
        </Link>
      </Button>
      <DemoNote className="mt-2">
        Rota de exemplo, com origem fictícia. Nenhum endereço, trânsito ou tempo de viagem foi calculado.
      </DemoNote>
    </Surface>
  )
}
