import { ArrowUpRight, Route } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import Eyebrow from '@/components/common/Eyebrow'
import PlanVisitLayout, { PlanVisitPanel } from '@/components/events/PlanVisitLayout'
import RouteMap from '@/components/map/RouteMap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEventRoutes } from '@/hooks/useEventRoutes'
import type { RouteState } from '@/hooks/useEventRoutes'
import { originSearch, parseMode, parseOrigin } from '@/lib/origin'
import { paths } from '@/lib/paths'
import { formatDistance, formatDuration, googleMapsUrl, routeMode, routeModes } from '@/lib/route'
import { cn } from '@/lib/utils'
import type { EventWithDetails, RouteMode } from '@/types'

const dotBase =
  "relative pl-5.5 before:absolute before:top-2 before:left-0 before:size-2 before:rounded-full before:border-2 before:border-maroon before:content-['']"

function cardSummary(mode: RouteMode, state: RouteState | undefined): { main: string; detail: string } {
  if (mode === 'onibus') return { main: 'Ver', detail: 'no Google Maps' }
  if (!state || state.status === 'loading') return { main: '…', detail: 'calculando' }
  if (state.status === 'error') return { main: '—', detail: 'indisponível' }
  const [route] = state.routes
  if (!route) return { main: '—', detail: 'sem trajeto' }
  return { main: formatDuration(route.duracao_segundos), detail: formatDistance(route.distancia_metros) }
}

export default function RoutePlan({ event }: { event: EventWithDetails }) {
  const [searchParams] = useSearchParams()
  const origin = parseOrigin(searchParams)
  const mode = parseMode(searchParams) ?? 'carro'
  const calculation = useEventRoutes(event.id, origin)
  const routes = calculation?.routes
  useDocumentTitle('Rota até o evento | CultHub')

  if (!origin) return <Navigate to={paths.eventOrigin(event.id)} replace />

  const changeOrigin = paths.eventOrigin(event.id, originSearch(origin, mode))
  const state = mode === 'onibus' ? undefined : routes?.[mode]
  const route = state?.status === 'ready' ? state.routes[0] : undefined
  const destination = [event.venue, event.venueAddress].filter(Boolean).join(', ')
  const mapsUrl = googleMapsUrl(origin, destination, mode)

  return (
    <PlanVisitLayout
      event={event}
      description="Compare as formas de chegar ao evento a partir da partida que você escolheu."
      status={
        <Badge variant="muted" size="md">
          <Route className="size-3.5" />
          {routeMode(mode).label}
          {route && ` • ${formatDuration(route.duracao_segundos)}`}
        </Badge>
      }
      map={
        <RouteMap origin={origin} destination={event.location} destinationLabel={event.venue} route={route} />
      }
    >
      <PlanVisitPanel aria-labelledby="trajeto-titulo" className="bg-cream">
        <h2 id="trajeto-titulo" className="mb-5 text-xl">
          Seu trajeto
        </h2>

        <div className="mb-5.5 grid gap-4">
          <div className={dotBase}>
            <Link to={changeOrigin} className="float-right text-2xs text-maroon underline">
              Alterar
            </Link>
            <small className="block text-2xs text-muted-foreground">Partida</small>
            <strong className="block text-xs">{origin.label ?? 'Ponto marcado no mapa'}</strong>
          </div>
          <div className={cn(dotBase, 'before:bg-maroon')}>
            <small className="block text-2xs text-muted-foreground">Destino</small>
            <strong className="block text-xs">{event.venue}</strong>
          </div>
        </div>

        <nav aria-label="Formas de chegar" className="mb-5.5">
          <ul className="grid grid-cols-3 gap-2">
            {routeModes.map((option) => {
              const summary = cardSummary(option.id, option.id === 'onibus' ? undefined : routes?.[option.id])
              const selected = option.id === mode
              return (
                <li key={option.id}>
                  <Link
                    to={paths.eventRoute(event.id, originSearch(origin, option.id))}
                    replace
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'block rounded-xl border px-1 py-3 text-center no-underline max-md:px-2.5 max-md:py-3.5',
                      selected ? 'border-sun/70 bg-primary/30' : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <strong className="block text-2xs">{option.label}</strong>
                    <span className="mt-1 block text-lg font-bold text-maroon">{summary.main}</span>
                    <small className="block text-2xs text-muted-foreground">{summary.detail}</small>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div aria-live="polite" className="mb-6 border-t border-maroon/10 pt-5">
          <RouteSummary mode={mode} state={state} changeOrigin={changeOrigin} onRetry={calculation?.retry} />
        </div>

        <Button asChild block>
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            {mode === 'onibus' ? 'Ver ônibus no Google Maps' : 'Abrir no Google Maps'} <ArrowUpRight />
            <span className="sr-only"> (abre em outra aba)</span>
          </a>
        </Button>

        <p className="mt-4.5 border-t border-border pt-4 text-2xs text-muted-foreground">
          Endereços, mapa e rotas © OpenStreetMap contributors. A partida só serve para traçar a rota e não
          fica guardada.
        </p>
      </PlanVisitPanel>
    </PlanVisitLayout>
  )
}

/** Fica dentro de um aria-live, por isso os textos não têm role próprio. */
function RouteSummary({
  mode,
  state,
  changeOrigin,
  onRetry,
}: Readonly<{ mode: RouteMode; state: RouteState | undefined; changeOrigin: string; onRetry?: () => void }>) {
  if (mode === 'onibus') {
    return (
      <p className="text-xs">
        O CultHub ainda não calcula trajetos de ônibus. Veja linhas, horários e baldeações no Google Maps.
      </p>
    )
  }
  if (!state || state.status === 'loading') return <p className="text-xs">Calculando a rota…</p>
  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-maroon">{state.message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            Tentar de novo
          </Button>
        )}
      </div>
    )
  }
  const [route] = state.routes
  if (!route) {
    return (
      <p className="text-xs">
        Não encontramos um trajeto a partir desse ponto. <Link to={changeOrigin}>Mude a partida</Link> para
        uma rua próxima e tente de novo.
      </p>
    )
  }
  return (
    <div className="flex items-end justify-between gap-3.5">
      <div>
        <strong className="block text-3xl tracking-tighter text-maroon">
          {formatDuration(route.duracao_segundos)}
        </strong>
        <small className="text-2xs">
          {formatDistance(route.distancia_metros)} • {mode === 'carro' ? 'de carro' : 'a pé'}
        </small>
      </div>
      {mode === 'carro' && (
        <Eyebrow className="max-w-32 text-right text-2xs text-muted-foreground">
          Sem trânsito em tempo real
        </Eyebrow>
      )}
    </div>
  )
}
