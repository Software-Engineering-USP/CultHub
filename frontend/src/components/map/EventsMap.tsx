import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { categories } from '@/lib/categories'
import { CENTRO_PADRAO, createMap, markerPin, pin, toLatLng } from '@/lib/leaflet'
import { cn } from '@/lib/utils'
import type { Coordinates, CultEvent } from '@/types'

interface EventsMapProps {
  events: CultEvent[]
  /** Posição da pessoa; o mapa centraliza nela quando ela chega */
  userPosition: Coordinates | null
  /** Muda a cada clique em "Minha localização", para centralizar de novo mesmo sem a posição mudar */
  recenter: number
  onSelect: (eventId: string) => void
  className?: string
}

function tooltip(text: string) {
  // Texto, não HTML: o título vem do catálogo.
  const span = document.createElement('span')
  span.textContent = text
  return span
}

/** Mapa da Home com um pino por evento (na cor da categoria) e a posição da pessoa. */
export default function EventsMap({
  events,
  userPosition,
  recenter,
  onSelect,
  className,
}: Readonly<EventsMapProps>) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const select = useRef(onSelect)

  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!container.current) return
    const instance = createMap(container.current, { scrollWheelZoom: true }).setView(
      toLatLng(CENTRO_PADRAO),
      12,
    )
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const markers = events.flatMap(({ id, title, category, location }) =>
      location
        ? [
            L.marker(toLatLng(location), { icon: markerPin(categories[category].pin, title), title })
              .bindTooltip(tooltip(title))
              .on('click', () => select.current(id))
              // O Enter num pino do Leaflet só abre popups; sem isso, quem usa teclado não abre o evento.
              .on('keypress', ({ originalEvent }: L.LeafletKeyboardEvent) => {
                if (originalEvent.key === 'Enter') select.current(id)
              }),
          ]
        : [],
    )
    const group = L.layerGroup(markers).addTo(instance)
    return () => {
      group.remove()
    }
  }, [events])

  const latitude = userPosition?.latitude
  const longitude = userPosition?.longitude

  useEffect(() => {
    const instance = map.current
    if (!instance || latitude === undefined || longitude === undefined) return
    const marker = L.marker([latitude, longitude], {
      icon: pin('bg-sun', 'Você está aqui'),
      title: 'Você está aqui',
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(instance)
    instance.setView([latitude, longitude], 13)
    return () => {
      marker.remove()
    }
  }, [latitude, longitude, recenter])

  return (
    <section
      ref={container}
      aria-label="Mapa dos eventos"
      className={cn('isolate overflow-hidden', className)}
    />
  )
}
