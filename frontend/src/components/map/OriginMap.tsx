import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Coordinates } from '@/types'

/** Centro de São Paulo, usado quando o local do evento não tem coordenadas. */
const CENTRO_PADRAO: Coordinates = { latitude: -23.5505, longitude: -46.6333 }

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function pin(className: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<span role="img" aria-label="${label}" class="block size-5 rounded-full border-[3px] border-white shadow-md ${className}"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function toLatLng({ latitude, longitude }: Coordinates): L.LatLngTuple {
  return [latitude, longitude]
}

function toCoordinates(latLng: L.LatLng): Coordinates {
  return { latitude: latLng.lat, longitude: latLng.lng }
}

interface OriginMapProps {
  /** Local do evento; também é o centro inicial do mapa */
  destination?: Coordinates
  destinationLabel: string
  /** Ponto de partida atual (o pino arrastável) */
  origin: Coordinates | null
  /** Chamado quando a pessoa clica no mapa ou solta o pino */
  onOriginChange: (origin: Coordinates) => void
  className?: string
}

/** Mapa do OpenStreetMap com o local do evento e um pino de partida arrastável. */
export default function OriginMap({
  destination,
  destinationLabel,
  origin,
  onOriginChange,
  className,
}: Readonly<OriginMapProps>) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const originMarker = useRef<L.Marker | null>(null)
  const onChange = useRef(onOriginChange)

  useEffect(() => {
    onChange.current = onOriginChange
  }, [onOriginChange])

  const destinationLat = destination?.latitude
  const destinationLng = destination?.longitude

  useEffect(() => {
    if (!container.current) return
    const center =
      destinationLat !== undefined && destinationLng !== undefined
        ? { latitude: destinationLat, longitude: destinationLng }
        : undefined
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
      toLatLng(center ?? CENTRO_PADRAO),
      center ? 15 : 12,
    )
    instance.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(instance)
    if (center) {
      L.marker(toLatLng(center), {
        icon: pin('bg-maroon', `Destino: ${destinationLabel}`),
        title: `Destino: ${destinationLabel}`,
        keyboard: false,
      }).addTo(instance)
    }
    instance.on('click', (event: L.LeafletMouseEvent) => onChange.current(toCoordinates(event.latlng)))
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      originMarker.current = null
    }
  }, [destinationLat, destinationLng, destinationLabel])

  const originLat = origin?.latitude
  const originLng = origin?.longitude

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (originLat === undefined || originLng === undefined) {
      originMarker.current?.remove()
      originMarker.current = null
      return
    }
    const position: L.LatLngTuple = [originLat, originLng]
    let marker = originMarker.current
    if (!marker) {
      marker = L.marker(position, {
        icon: pin('bg-sun', 'Partida'),
        title: 'Partida (arraste para ajustar)',
        draggable: true,
        autoPan: true,
      }).addTo(instance)
      marker.on('dragend', () => onChange.current(toCoordinates(marker!.getLatLng())))
      originMarker.current = marker
    } else if (marker.getLatLng().equals(position)) {
      // Veio do próprio arraste: o pino já está no lugar.
      return
    } else {
      marker.setLatLng(position)
    }
    if (!instance.getBounds().contains(position)) instance.panTo(position)
  }, [originLat, originLng])

  return (
    <figure className={className}>
      <div
        ref={container}
        role="region"
        aria-label="Mapa para escolher o ponto de partida"
        className="isolate h-[min(690px,70vh)] w-full overflow-hidden rounded-3xl border border-border max-md:h-80 max-sm:rounded-2xl"
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Clique no mapa ou arraste o pino amarelo para ajustar o ponto de partida. O pino vinho é o local do
        evento.
      </figcaption>
    </figure>
  )
}
