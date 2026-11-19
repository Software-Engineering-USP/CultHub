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

function tooltip(titles: string[]) {
  const list = document.createElement('span')
  list.className = 'grid gap-1'
  for (const title of titles) {
    const item = document.createElement('span')
    item.textContent = title
    list.append(item)
  }
  return list
}

function eventLabel(event: CultEvent) {
  if (!event.eventDate) return event.title
  const [year, month, day] = event.eventDate.split('-')
  const date = `${day}/${month}/${year}`
  const time = event.eventTime ? ` às ${event.eventTime.slice(0, 5)}` : ''
  return `${event.title} — ${date}${time}`
}

function eventMapCategory(event: CultEvent) {
  return event.category
}

function uniqueOccurrences(events: CultEvent[]) {
  const unique = new Map<string, CultEvent>()
  for (const event of events) {
    // A mesma ocorrência pode vir de provedores diferentes com IDs distintos.
    // Agrupar por título, data e hora evita duplicá-la no seletor do pin.
    const key = [
      event.title.trim().toLocaleLowerCase('pt-BR'),
      event.eventDate ?? '',
      event.eventTime ?? '',
    ].join('|')
    if (!unique.has(key)) unique.set(key, event)
  }
  return [...unique.values()]
}

function eventChoices(events: CultEvent[], onSelect: (id: string) => void) {
  const list = document.createElement('div')
  list.className = 'grid min-w-45 gap-1'
  const heading = document.createElement('strong')
  heading.textContent = `${events.length} eventos neste local`
  list.append(heading)
  for (const event of events) {
    const button = document.createElement('button')
    button.type = 'button'
    const category = eventMapCategory(event)
    button.className = [
      'cursor-pointer rounded px-2 py-1.5 text-left',
      categories[category].card,
      categories[category].text,
    ].join(' ')
    button.textContent = eventLabel(event)
    button.addEventListener('click', () => onSelect(event.id))
    list.append(button)
  }
  L.DomEvent.disableClickPropagation(list)
  return list
}

/** Mapa da Home com pinos agrupados por local e a posição da pessoa. */
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
    const byLocation = new Map<string, CultEvent[]>()
    for (const event of events) {
      if (!event.location) continue
      const key = `${event.location.latitude.toFixed(5)},${event.location.longitude.toFixed(5)}`
      const group = byLocation.get(key) ?? []
      group.push(event)
      byLocation.set(key, group)
    }
    const markers = [...byLocation.values()].map((eventsAtPlace) => {
      const group = uniqueOccurrences(eventsAtPlace)
      const first = group[0]!
      const labels = group.map(eventLabel)
      const colorCategories = [...new Set(group.map(eventMapCategory))]
      const firstCategory = eventMapCategory(first)
      const orderedColorCategories = [
        ...colorCategories.filter((category) => category !== firstCategory),
        firstCategory,
      ]
      const stackColors = orderedColorCategories.map((category) => categories[category].pin)
      const label =
        group.length === 1 ? first.title : `${group.length} eventos neste local: ${labels.join(', ')}`
      const marker = L.marker(toLatLng(first.location!), {
        icon: markerPin(categories[firstCategory].pin, label, group.length, stackColors),
        title: label,
      }).bindTooltip(tooltip(labels))

      if (group.length === 1) {
        marker.on('click', () => select.current(first.id))
      } else {
        marker.bindPopup(() => eventChoices(group, (id) => select.current(id)))
      }
      // Enter abre o evento individual ou a lista de opções do local agrupado.
      marker.on('keypress', ({ originalEvent }: L.LeafletKeyboardEvent) => {
        if (originalEvent.key !== 'Enter') return
        if (group.length === 1) select.current(first.id)
        else marker.openPopup()
      })
      return marker
    })
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
