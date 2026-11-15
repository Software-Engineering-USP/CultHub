import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { CENTRO_PADRAO, createMap, pin, toLatLng } from '@/components/map/leaflet'
import type { CalculatedRoute, Coordinates } from '@/types'

/** A licença dos dados e a política do servidor de rotas pedem um link para corrigir o mapa. */
const FIX_THE_MAP = ' · <a href="https://www.openstreetmap.org/fixthemap">Corrigir o mapa</a>'

/** Lidas de `src/index.css` (`--color-maroon` e `--color-slate`); o Leaflet pinta o SVG com cor direta. */
function themeColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function point(latitude: number | undefined, longitude: number | undefined): Coordinates | undefined {
  return latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined
}

/** Marcador num grupo, para medir os limites do mesmo jeito que as rotas. */
function marker(position: Coordinates, className: string, label: string) {
  return L.featureGroup([
    L.marker(toLatLng(position), { icon: pin(className, label), title: label, keyboard: false }),
  ])
}

/** Linhas das rotas; a destacada vai por último, para ficar por cima das alternativas. */
function routeLines(routes: CalculatedRoute[], selected: number) {
  const highlight = themeColor('--color-maroon', '#761918')
  const muted = themeColor('--color-slate', '#64748b')
  const line = (route: CalculatedRoute, active: boolean) =>
    // L.geoJSON lê os pares [longitude, latitude] do GeoJSON.
    L.geoJSON(route.geometria, {
      style: active
        ? { color: highlight, weight: 6, opacity: 0.9 }
        : { color: muted, weight: 4, opacity: 0.5 },
    })
  const alternatives = routes.filter((_, index) => index !== selected).map((route) => line(route, false))
  const chosen = routes[selected]
  return chosen ? [...alternatives, line(chosen, true)] : alternatives
}

/** Enquadra tudo o que está no mapa; sem nada, mostra o centro padrão. */
function fitAll(instance: L.Map, layers: L.FeatureGroup[]) {
  const bounds = L.latLngBounds([])
  layers.forEach((layer) => {
    const layerBounds = layer.getBounds()
    if (layerBounds.isValid()) bounds.extend(layerBounds)
  })
  if (bounds.isValid()) instance.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
  else instance.setView(toLatLng(CENTRO_PADRAO), 12)
}

interface RouteMapProps {
  destination?: Coordinates
  destinationLabel: string
  origin?: Coordinates
  /** Rotas do modo escolhido; `selected` é a destacada, as outras ficam em cinza */
  routes: CalculatedRoute[]
  selected: number
  className?: string
}

/** Mapa do OpenStreetMap com a partida, o local do evento e o trajeto calculado. */
export default function RouteMap({
  destination,
  destinationLabel,
  origin,
  routes,
  selected,
  className,
}: Readonly<RouteMapProps>) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!container.current) return
    const instance = createMap(container.current, FIX_THE_MAP)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [])

  const destinationLat = destination?.latitude
  const destinationLng = destination?.longitude
  const originLat = origin?.latitude
  const originLng = origin?.longitude

  // Marcadores e trajeto são refeitos juntos; o mapa (e os tiles) continua o mesmo.
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const destinationPoint = point(destinationLat, destinationLng)
    const originPoint = point(originLat, originLng)
    const layers: L.FeatureGroup[] = [
      ...(destinationPoint ? [marker(destinationPoint, 'bg-maroon', `Destino: ${destinationLabel}`)] : []),
      ...(originPoint ? [marker(originPoint, 'bg-sun', 'Partida')] : []),
      ...routeLines(routes, selected),
    ]
    layers.forEach((layer) => layer.addTo(instance))
    fitAll(instance, layers)
    return () => layers.forEach((layer) => layer.remove())
  }, [destinationLat, destinationLng, destinationLabel, originLat, originLng, routes, selected])

  return (
    <figure className={className}>
      <section
        ref={container}
        aria-label="Mapa do trajeto até o evento"
        className="isolate h-[min(690px,70vh)] w-full overflow-hidden rounded-3xl border border-border max-md:h-80 max-sm:rounded-2xl"
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">
        O pino amarelo é a partida e o vinho, o local do evento. O trajeto destacado é o escolhido; os em
        cinza são alternativas. Confira o percurso antes de sair.
      </figcaption>
    </figure>
  )
}
