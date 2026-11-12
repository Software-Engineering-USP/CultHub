import { ArrowRight, LocateFixed, MapPin } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import DemoNote from '@/components/common/DemoNote'
import IconTile from '@/components/common/IconTile'
import PlanVisitLayout, { PlanVisitPanel } from '@/components/events/PlanVisitLayout'
import AddressSearch from '@/components/map/AddressSearch'
import OriginMap from '@/components/map/OriginMap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRouteOptions } from '@/hooks/useRouteOptions'
import { peerFocusRing } from '@/lib/classes'
import { onFormSubmit, text } from '@/lib/forms'
import { originSearch, parseMode, parseOrigin } from '@/lib/origin'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { rotasApi } from '@/services/rotas'
import type { Coordinates, EventWithDetails, RouteOption, RouteOrigin } from '@/types'

type GeoStatus = 'idle' | 'locating' | 'denied' | 'unavailable'

/** Código de GeolocationPositionError para permissão negada. */
const PERMISSAO_NEGADA = 1

const geoMessages: Record<Exclude<GeoStatus, 'idle' | 'locating'>, string> = {
  denied: 'Você não permitiu o uso da localização. Tudo bem: informe um endereço ou marque o ponto no mapa.',
  unavailable: 'Não conseguimos obter sua localização agora. Informe um endereço ou marque o ponto no mapa.',
}

function sameCoordinates(a: Coordinates | null, b: Coordinates) {
  return a?.latitude === b.latitude && a?.longitude === b.longitude
}

export default function Origin({ event }: { event: EventWithDetails }) {
  const navigate = useNavigate()
  const routeOptions = useRouteOptions(event.id)
  const [searchParams] = useSearchParams()
  const [origin, setOrigin] = useState<RouteOrigin | null>(() => parseOrigin(searchParams) ?? null)
  const [query, setQuery] = useState(() => origin?.label ?? '')
  const [initialMode] = useState(() => parseMode(searchParams) ?? 'carro')
  const [geo, setGeo] = useState<GeoStatus>('idle')
  const [reverse, setReverse] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const reverseRequest = useRef<AbortController | null>(null)
  useDocumentTitle('Defina sua origem | CultHub')

  useEffect(() => () => reverseRequest.current?.abort(), [])

  /** Coloca o pino num ponto e busca o endereço dele só para a pessoa conferir. */
  const placeOrigin = useCallback((point: Coordinates) => {
    setOrigin({ ...point, label: null })
    setQuery('')
    setSubmitError(null)
    reverseRequest.current?.abort()
    const controller = new AbortController()
    reverseRequest.current = controller
    setReverse({ loading: true, error: null })
    rotasApi
      .reversa(point, controller.signal)
      .then((label) => {
        setOrigin((current) => (sameCoordinates(current, point) ? { ...point, label } : current))
        setQuery(label ?? '')
        setReverse({ loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setReverse({
          loading: false,
          error:
            error instanceof Error
              ? `${error.message} O ponto marcado ainda pode ser usado.`
              : 'Não conseguimos o endereço deste ponto, mas ele ainda pode ser usado.',
        })
      })
  }, [])

  function requestMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable')
      return
    }
    setGeo('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo('idle')
        placeOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      },
      (error) => setGeo(error.code === PERMISSAO_NEGADA ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  let originText = 'Ainda não definida'
  if (origin)
    originText = origin.label ?? (reverse.loading ? 'Buscando o endereço…' : 'Ponto marcado no mapa')

  return (
    <PlanVisitLayout
      event={event}
      description="Seu próximo encontro com a música começa com um ponto de partida."
      status={
        <Badge variant="muted" size="md">
          <LocateFixed className="size-3.5" />
          {origin ? 'Partida definida' : 'Defina sua origem para começar'}
        </Badge>
      }
      map={
        <OriginMap
          destination={event.location}
          destinationLabel={event.venue}
          origin={origin}
          onOriginChange={placeOrigin}
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

        {(geo === 'denied' || geo === 'unavailable') && (
          <div role="alert" className="mb-4 rounded-xl border border-border bg-accent px-4 py-3.5">
            <strong className="mb-1.5 block text-xs text-maroon">Localização indisponível</strong>
            <p className="text-xs">{geoMessages[geo]}</p>
          </div>
        )}

        <Button
          block
          aria-describedby="geolocalizacao-aviso"
          disabled={geo === 'locating'}
          onClick={requestMyLocation}
        >
          <LocateFixed />
          {geo === 'locating' ? 'Obtendo sua localização…' : 'Usar minha localização'}
        </Button>
        <DemoNote id="geolocalizacao-aviso" size="xs" className="mt-2.5">
          O navegador pede sua permissão. A localização só posiciona o pino e não é guardada.
        </DemoNote>

        <div className="my-4 flex items-center gap-2.5 text-2xs text-muted-foreground before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']">
          ou informe a partida
        </div>

        <form
          aria-label="Definir partida"
          autoComplete="off"
          noValidate
          onSubmit={onFormSubmit((data) => {
            if (!origin) {
              setSubmitError(
                'Escolha uma das sugestões de endereço, use sua localização ou marque o ponto no mapa.',
              )
              document.getElementById('endereco')?.focus()
              return
            }
            const mode = text(data, 'transporte') as RouteOption['id']
            navigate(paths.eventRoute(event.id, originSearch(origin, mode)))
          })}
        >
          <AddressSearch
            id="endereco"
            label="Endereço de partida"
            help="Digite ao menos 3 letras e escolha uma das sugestões."
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setSubmitError(null)
            }}
            confirmed={origin?.label}
            near={event.location}
            invalid={Boolean(submitError)}
            onSelect={(sugestao) => {
              reverseRequest.current?.abort()
              setReverse({ loading: false, error: null })
              setOrigin({
                latitude: sugestao.latitude,
                longitude: sugestao.longitude,
                label: sugestao.rotulo,
              })
              setQuery(sugestao.rotulo)
              setSubmitError(null)
            }}
          />

          <div className="mb-4 grid gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <div aria-live="polite">
              <small className="flex items-center gap-1 text-2xs text-muted-foreground">
                <MapPin className="size-3" /> Partida
              </small>
              <strong className="text-xs">{originText}</strong>
              {reverse.error && <small className="mt-1 block text-2xs text-maroon">{reverse.error}</small>}
            </div>
            <div>
              <small className="block text-2xs text-muted-foreground">Destino</small>
              <strong className="text-xs">{event.venue}</strong>
            </div>
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
                    defaultChecked={route.id === initialMode}
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
            O trajeto e os tempos de cada transporte ainda são de exemplo.
          </DemoNote>

          {submitError && (
            <p role="alert" className="mb-3 text-xs text-maroon">
              {submitError}
            </p>
          )}

          <Button type="submit" block>
            Traçar rota <ArrowRight />
          </Button>
        </form>

        <Button asChild variant="link" className="mt-4 flex">
          <Link to={paths.eventRoute(event.id)}>
            Ver rota de exemplo <ArrowRight />
          </Link>
        </Button>

        <DemoNote size="xs" className="mt-4.5 border-t border-border pt-4">
          Endereços e mapa © OpenStreetMap contributors. O endereço digitado e o ponto marcado só servem para
          traçar a rota e não ficam guardados.
        </DemoNote>
      </PlanVisitPanel>
    </PlanVisitLayout>
  )
}
