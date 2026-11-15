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
    const layers: L.Layer[] = []
    const bounds = L.latLngBounds([])

    if (destinationLat !== undefined && destinationLng !== undefined) {
      const position: L.LatLngTuple = [destinationLat, destinationLng]
      bounds.extend(position)
      layers.push(
        L.marker(position, {
          icon: pin('bg-maroon', `Destino: ${destinationLabel}`),
          title: `Destino: ${destinationLabel}`,
          keyboard: false,
        }),
      )
    }
    if (originLat !== undefined && originLng !== undefined) {
      const position: L.LatLngTuple = [originLat, originLng]
      bounds.extend(position)
      layers.push(L.marker(position, { icon: pin('bg-sun', 'Partida'), title: 'Partida', keyboard: false }))
    }

    const highlight = themeColor('--color-maroon', '#761918')
    const muted = themeColor('--color-slate', '#64748b')
    // A destacada vai por último, para ficar por cima das alternativas.
    const order = routes.map((_, index) => index).filter((index) => index !== selected)
    if (routes[selected]) order.push(selected)
    for (const index of order) {
      const active = index === selected
      // L.geoJSON lê os pares [longitude, latitude] do GeoJSON.
      const line = L.geoJSON(routes[index].geometria, {
        style: { color: active ? highlight : muted, weight: active ? 6 : 4, opacity: active ? 0.9 : 0.5 },
      })
      layers.push(line)
      if (line.getBounds().isValid()) bounds.extend(line.getBounds())
    }

    layers.forEach((layer) => layer.addTo(instance))
    if (bounds.isValid()) instance.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
    else instance.setView(toLatLng(CENTRO_PADRAO), 12)

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
