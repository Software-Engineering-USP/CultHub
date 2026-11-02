import { Link } from 'react-router-dom'
import DemoNote from '@/components/common/DemoNote'
import Eyebrow from '@/components/common/Eyebrow'
import Surface from '@/components/common/Surface'
import { Button } from '@/components/ui/button'
import { useRouteOptions } from '@/hooks/useRouteOptions'
import { paths } from '@/lib/paths'
import type { CultEvent } from '@/types'

/** Resumo de rotas na página do evento. */
export default function RoutePreview({ event }: { event: CultEvent }) {
  const routeOptions = useRouteOptions(event.id)

  return (
    <Surface as="section" aria-labelledby="rota-titulo" bg="bg-[#fbe9cf]">
      <div className="flex items-center justify-between gap-[14px]">
        <h3 id="rota-titulo" className="text-[17px]">
          Planejar rota
        </h3>
        <Eyebrow className="text-[10px] text-muted-foreground">{event.details?.startTime} · EXEMPLO</Eyebrow>
      </div>
      <p className="mt-2 text-[12px]">De sua localização até o {event.venue}</p>

      <div className="my-5 grid gap-[10px]">
        {routeOptions.map((route) => (
          <div
            key={route.id}
            className="flex items-center justify-between gap-3 rounded-[13px] border border-line bg-surface px-[15px] py-[13px] text-[12px]"
          >
            <div>
              <strong className="block">{route.label}</strong>
              <span className="text-[11px] text-muted-foreground">
                {route.detail} • {route.tag}
              </span>
            </div>
            <div className="text-right text-[15px] font-bold text-maroon">
              {route.time}
              <small className="block text-[10px] font-medium text-muted-foreground">Tempo ilustrativo</small>
            </div>
          </div>
        ))}
      </div>

      <Button asChild block>
        <Link to={paths.eventRoute(event.id)} aria-label="Ver rota completa de exemplo">
          Ver rota completa <span aria-hidden="true">→</span>
        </Link>
      </Button>
      <DemoNote size="sm" className="mt-2">
        Rota de exemplo, com origem fictícia. Nenhum endereço, trânsito ou tempo de viagem foi calculado.
      </DemoNote>
    </Surface>
  )
}
