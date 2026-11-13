import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { CENTRO_PADRAO, createMap, pin, toCoordinates, toLatLng } from '@/lib/leaflet'
import type { Coordinates } from '@/types'

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

  // O mapa é criado uma vez; destino e origem só atualizam marcadores, sem recarregar os tiles.
  useEffect(() => {
    if (!container.current) return
    const instance = createMap(container.current)
    instance.on('click', (event: L.LeafletMouseEvent) => onChange.current(toCoordinates(event.latlng)))
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      originMarker.current = null
    }
  }, [])

  useEffect(() => {
    const center =
      destinationLat !== undefined && destinationLng !== undefined
        ? { latitude: destinationLat, longitude: destinationLng }
        : undefined
    map.current?.setView(toLatLng(center ?? CENTRO_PADRAO), center ? 15 : 12)
  }, [destinationLat, destinationLng])

  useEffect(() => {
    const instance = map.current
    if (!instance || destinationLat === undefined || destinationLng === undefined) return
    const marker = L.marker([destinationLat, destinationLng], {
      icon: pin('bg-maroon', `Destino: ${destinationLabel}`),
      title: `Destino: ${destinationLabel}`,
      keyboard: false,
    }).addTo(instance)
    return () => {
      marker.remove()
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
      <section
        ref={container}
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
