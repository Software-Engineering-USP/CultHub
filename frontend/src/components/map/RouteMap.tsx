import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { createMap, OSM_ATTRIBUTION, pin } from '@/lib/leaflet'
import type { RotaCalculada } from '@/services/rotas'
import type { Coordinates } from '@/types'

// A política do servidor de rotas (routing.openstreetmap.de) pede um link para corrigir o mapa.
const ATTRIBUTION = `${OSM_ATTRIBUTION} · <a href="https://www.openstreetmap.org/fixthemap">Corrigir o mapa</a>`

interface RouteMapProps {
  origin: Coordinates
  destination?: Coordinates
  destinationLabel: string
  route?: RotaCalculada
  className?: string
}

export default function RouteMap({
  origin,
  destination,
  destinationLabel,
  route,
  className,
}: Readonly<RouteMapProps>) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!container.current) return
    const instance = createMap(container.current, ATTRIBUTION)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [])

  // Números, não objetos: um objeto novo a cada render reenquadraria o mapa e perderia o zoom.
  const { latitude: originLat, longitude: originLng } = origin
  const destinationLat = destination?.latitude
  const destinationLng = destination?.longitude

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const layers: L.Layer[] = [
      L.marker([originLat, originLng], { icon: pin('bg-sun', 'Partida'), title: 'Partida', keyboard: false }),
    ]
    if (destinationLat !== undefined && destinationLng !== undefined) {
      layers.push(
        L.marker([destinationLat, destinationLng], {
          icon: pin('bg-maroon', `Destino: ${destinationLabel}`),
          title: `Destino: ${destinationLabel}`,
          keyboard: false,
        }),
      )
    }
    // L.geoJSON já lê os pares [longitude, latitude] do GeoJSON.
    if (route)
      layers.push(
        L.geoJSON(route.geometria, { style: { className: 'stroke-maroon', weight: 5, opacity: 0.85 } }),
      )
    const group = L.featureGroup(layers).addTo(instance)
    instance.fitBounds(group.getBounds(), { padding: [32, 32], maxZoom: 16 })
    return () => {
      group.remove()
    }
  }, [originLat, originLng, destinationLat, destinationLng, destinationLabel, route])

  return (
    <figure className={className}>
      <section
        ref={container}
        aria-label="Mapa do trajeto até o evento"
        className="isolate h-[min(690px,70vh)] w-full overflow-hidden rounded-3xl border border-border max-md:h-80 max-sm:rounded-2xl"
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">
        O pino amarelo é a partida e o vinho é o local do evento.
      </figcaption>
    </figure>
  )
}
