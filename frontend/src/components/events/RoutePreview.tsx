import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Eyebrow from '@/components/common/Eyebrow'
import Surface from '@/components/common/Surface'
import { Button } from '@/components/ui/button'
import { useEventRoutes } from '@/hooks/useEventRoutes'
import type { RouteState } from '@/hooks/useEventRoutes'
import { usePreviewOrigin } from '@/hooks/usePreviewOrigin'
import { originSearch } from '@/lib/origin'
import { paths } from '@/lib/paths'
import { formatDistance, formatDuration, googleMapsUrl, routeModes } from '@/lib/route'
import type { CultEvent } from '@/types'

function summary(state: RouteState | undefined): { time: string; detail: string } {
  if (!state || state.status === 'loading') return { time: '…', detail: 'Calculando' }
  if (state.status === 'error') return { time: '—', detail: 'Indisponível desta partida' }
  const [route] = state.routes
  if (!route) return { time: '—', detail: 'Sem trajeto desta partida' }
  return { time: formatDuration(route.duracao_segundos), detail: formatDistance(route.distancia_metros) }
}

/** Tempos na página do evento, a partir de uma partida estimada (ver usePreviewOrigin). */
export default function RoutePreview({ event }: Readonly<{ event: CultEvent }>) {
  const preview = usePreviewOrigin(event.location)
  const calculation = useEventRoutes(event.id, preview?.origin)
  const routes = calculation?.routes
  const failed = routes && Object.values(routes).some((state) => state.status === 'error')
  const destination = [event.venue, event.venueAddress].filter(Boolean).join(', ')

  return (
    <Surface as="section" aria-labelledby="rota-titulo" className="bg-cream">
      <div className="flex items-center justify-between gap-3.5">
        <h3 id="rota-titulo" className="text-lg">
          Planejar rota
        </h3>
        {preview && (
          <Eyebrow className="text-right text-2xs text-muted-foreground">
            {preview.source === 'device' ? 'Da sua localização' : 'Do centro de SP'}
          </Eyebrow>
        )}
      </div>

      {preview === undefined && <p className="mt-2 text-xs text-muted-foreground">Calculando os tempos…</p>}
      {preview && (
        <>
          <ul aria-label="Tempo até o local" aria-live="polite" className="my-5 grid gap-2.5">
            {routeModes.map((mode) => {
              const row = mode.id === 'onibus' ? null : summary(routes?.[mode.id])
              return (
                <li
                  key={mode.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs"
                >
                  <div>
                    <strong className="block">{mode.label}</strong>
                    <span className="text-muted-foreground">{row ? row.detail : 'Linhas e horários'}</span>
                  </div>
                  {row ? (
                    <span className="text-base font-bold text-maroon">{row.time}</span>
                  ) : (
                    <a
                      href={googleMapsUrl(preview.origin, destination, mode.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-semibold text-maroon"
                    >
                      Google Maps <ArrowUpRight className="size-3.5" />
                      <span className="sr-only"> (abre em outra aba)</span>
                    </a>
                  )}
                </li>
              )
            })}
          </ul>

          {failed && calculation && (
            <Button variant="outline" size="sm" onClick={calculation.retry} className="mb-3">
              Tentar de novo
            </Button>
          )}
          <Button asChild block>
            <Link to={paths.eventRoute(event.id, originSearch(preview.origin))}>
              Ver rota completa <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="link" className="mt-2 flex">
            <Link to={paths.eventOrigin(event.id)}>Escolher outra partida</Link>
          </Button>
          <p className="mt-2 text-2xs text-muted-foreground">Tempos de carro sem trânsito em tempo real.</p>
        </>
      )}
      {preview === null && (
        <>
          <p className="mt-2 text-xs">Escolha de onde vai sair para ver os tempos de carro, ônibus e a pé.</p>
          <Button asChild block className="mt-5">
            <Link to={paths.eventOrigin(event.id)}>
              Definir partida <ArrowRight />
            </Link>
          </Button>
        </>
      )}
    </Surface>
  )
}
