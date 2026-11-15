import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DemoNote from '@/components/common/DemoNote'
import IconTile from '@/components/common/IconTile'
import PlanVisitLayout, { PlanVisitPanel } from '@/components/events/PlanVisitLayout'
import RouteMap from '@/components/map/RouteMap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEventRoutes } from '@/hooks/useEventRoutes'
import type { ModeRoutes } from '@/hooks/useEventRoutes'
import {
  formatDistance,
  formatDuration,
  openStreetMapDirections,
  originSearch,
  parseMode,
  parseOrigin,
  transportModes,
} from '@/lib/origin'
import type { RoutableMode } from '@/lib/origin'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CalculatedRoute, EventWithDetails, RouteOrigin } from '@/types'

/** Chave estável de uma rota: rotas diferentes não têm a mesma distância, duração e número de pontos. */
function routeKey(route: CalculatedRoute) {
  return `${route.distancia_metros}:${route.duracao_segundos}:${route.geometria.coordinates.length}`
}

const modeText: Record<RoutableMode, string> = { carro: 'de carro', ape: 'a pé' }

const dotBase =
  "relative pl-5.5 before:absolute before:top-2 before:left-0 before:size-2 before:rounded-full before:border-2 before:border-maroon before:content-['']"

function Notice({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div role="alert" className="mb-5.5 rounded-xl border border-border bg-accent px-4 py-3.5">
      <strong className="mb-1.5 block text-xs text-maroon">{title}</strong>
      <div className="text-xs">{children}</div>
    </div>
  )
}

/** Tempo e distância da rota recomendada de um modo, para a comparação. */
function modeSummary(state: ModeRoutes | undefined) {
  if (!state || state.status === 'loading') return { time: '…', detail: 'Calculando' }
  if (state.status === 'error') return { time: '—', detail: 'Indisponível' }
  const [best] = state.rotas
  if (!best) return { time: '—', detail: 'Sem caminho' }
  return { time: formatDuration(best.duracao_segundos), detail: formatDistance(best.distancia_metros) }
}

export default function RoutePlan({ event }: { event: EventWithDetails }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const origin = parseOrigin(searchParams)
  const mode = parseMode(searchParams) ?? 'carro'
  const routes = useEventRoutes(event.id, origin)
  const [choice, setChoice] = useState({ key: '', index: 0 })
  useDocumentTitle(`Rota até ${event.venue} | CultHub`)

  const changeOrigin = paths.eventOrigin(event.id, origin ? originSearch(origin, mode) : '')
  const state = routes?.[mode]
  const ready = state?.status === 'ready' ? state : undefined
  // A alternativa escolhida só vale para o modo e a partida em que foi escolhida.
  const choiceKey = `${mode}|${origin?.latitude}|${origin?.longitude}`
  const index = choice.key === choiceKey && ready?.rotas[choice.index] ? choice.index : 0
  const route = ready?.rotas[index]
  const destination = event.location ?? ready?.destino

  return (
    <PlanVisitLayout
      event={event}
      description="Planeje seu caminho até o evento e compare as opções de transporte."
      status={
        <Badge variant="muted" size="md">
          {origin ? 'Partida definida' : 'Defina sua partida'}
        </Badge>
      }
      map={
        <RouteMap
          destination={destination}
          destinationLabel={event.venue}
          origin={origin}
          routes={ready?.rotas ?? []}
          selected={index}
        />
      }
    >
      {origin ? (
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

          <ul aria-label="Comparação de transportes" className="mb-5.5 grid grid-cols-3 gap-2">
            {transportModes.map((option) => {
              const id = option.id
              const routable = option.available && id !== 'onibus'
              const summary = routable ? modeSummary(routes?.[id]) : { time: '—', detail: 'Em breve' }
              const active = option.id === mode
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={routable ? active : undefined}
                    disabled={!routable}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.set('modo', option.id)
                      setSearchParams(next, { replace: true })
                    }}
                    className={cn(
                      'block w-full rounded-xl border px-1 py-3 text-center focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 max-md:px-2.5 max-md:py-3.5',
                      active ? 'border-sun/70 bg-primary/30' : 'border-border bg-card',
                    )}
                  >
                    <strong className="block text-2xs">{option.label}</strong>
                    <span className="mt-1 block text-lg font-bold text-maroon">{summary.time}</span>
                    <small className="block text-2xs text-muted-foreground">{summary.detail}</small>
                  </button>
                </li>
              )
            })}
          </ul>

          <RouteDetails
            event={event}
            origin={origin}
            mode={mode}
            state={state}
            index={index}
            changeOrigin={changeOrigin}
            onChoose={(chosen) => setChoice({ key: choiceKey, index: chosen })}
          />

          {route && destination && (
            <Button asChild block>
              <a
                href={openStreetMapDirections(origin, destination, mode)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no OpenStreetMap <ArrowUpRight />
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          )}

          <DemoNote size="xs" className="mt-4.5 border-t border-border pt-4">
            Rotas e mapa © OpenStreetMap contributors. O tempo é estimado pela velocidade das vias, sem
            trânsito em tempo real. A partida só serve para calcular a rota e não fica guardada.
          </DemoNote>
        </PlanVisitPanel>
      ) : (
        <PlanVisitPanel aria-labelledby="partida-titulo">
          <div className="mb-4 flex items-center gap-3">
            <IconTile icon={MapPin} />
            <h2 id="partida-titulo" className="text-xl max-sm:text-lg">
              Defina sua partida
            </h2>
          </div>
          <p className="mb-5 text-xs">
            Para calcular o trajeto de carro e a pé até o {event.venue}, diga de onde você vai sair.
          </p>
          <Button asChild block>
            <Link to={paths.eventOrigin(event.id)}>
              Escolher ponto de partida <ArrowRight />
            </Link>
          </Button>
        </PlanVisitPanel>
      )}
    </PlanVisitLayout>
  )
}

interface RouteDetailsProps {
  event: EventWithDetails
  origin: RouteOrigin
  mode: RoutableMode
  state: ModeRoutes | undefined
  index: number
  changeOrigin: string
  onChoose: (index: number) => void
}

/** Resumo, alternativas e itinerário do modo escolhido (ou o aviso de erro/rota vazia). */
function RouteDetails({
  event,
  origin,
  mode,
  state,
  index,
  changeOrigin,
  onChoose,
}: Readonly<RouteDetailsProps>) {
  const alterLink = (
    <Link to={changeOrigin} className="text-maroon underline">
      Alterar partida
    </Link>
  )

  if (!state || state.status === 'loading') {
    return (
      <output className="mb-5.5 block text-xs text-muted-foreground">
        Calculando a rota {modeText[mode]}…
      </output>
    )
  }
  if (state.status === 'error') {
    return (
      <Notice title="Não conseguimos calcular a rota">
        <p>{state.error}</p>
        <p className="mt-1.5">{alterLink}</p>
      </Notice>
    )
  }
  const route = state.rotas[index]
  if (!route) {
    return (
      <Notice title="Nenhum caminho encontrado">
        <p>
          Não encontramos um caminho {modeText[mode]} a partir deste ponto. Mova o pino para perto de uma rua.
        </p>
        <p className="mt-1.5">{alterLink}</p>
      </Notice>
    )
  }

  const distance = formatDistance(route.distancia_metros)
  const itinerary = [
    { title: `Parta de ${origin.label ?? 'ponto marcado no mapa'}`, detail: 'Partida que você escolheu.' },
    { title: 'Siga o trajeto destacado no mapa', detail: `${distance} ${modeText[mode]}.` },
    { title: `Chegue ao ${event.venue}`, detail: 'Confirme o acesso nos canais do local.' },
  ]

  return (
    <>
      <div className="mb-5.5 border-t border-maroon/10 pt-5">
        <strong className="block text-3xl tracking-tighter text-maroon">
          {formatDuration(route.duracao_segundos)}
        </strong>
        <small className="text-2xs">
          {distance} • {modeText[mode]}
          {mode === 'carro' && ' • estimado sem trânsito'}
        </small>
      </div>

      {state.rotas.length > 1 && (
        <fieldset className="mb-5.5 min-w-0">
          <legend className="mb-2 text-xs font-semibold">Opções de trajeto</legend>
          <div className="grid gap-2">
            {state.rotas.map((option, position) => (
              <label
                key={routeKey(option)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-2xs has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring',
                  position === index
                    ? 'border-sun/70 bg-primary/30 font-bold text-maroon'
                    : 'border-border bg-card',
                )}
              >
                <input
                  type="radio"
                  name="alternativa"
                  checked={position === index}
                  onChange={() => onChoose(position)}
                  className="size-3 accent-maroon"
                />
                <span className="flex-1">
                  Opção {position + 1}
                  {position === 0 && ' · recomendada'}
                </span>
                <span>
                  {formatDuration(option.duracao_segundos)} · {formatDistance(option.distancia_metros)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <h3 className="text-sm">Itinerário</h3>
        <ol className="mt-4 mb-5.5">
          {itinerary.map((step, position) => (
            <li key={step.title} className="relative pb-5 pl-8 text-xs last:pb-0">
              <span
                aria-hidden="true"
                className="absolute top-px left-0 grid size-5.5 place-items-center rounded-full bg-muted text-2xs font-bold text-maroon"
              >
                {position + 1}
              </span>
              <strong className="block">{step.title}</strong>
              <span className="mt-1 block text-2xs text-muted-foreground">{step.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}
