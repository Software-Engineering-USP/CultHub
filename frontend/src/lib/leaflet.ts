import L from 'leaflet'
import type { Coordinates } from '@/types'

/** Centro de São Paulo, usado quando o local do evento não tem coordenadas. */
export const CENTRO_PADRAO: Coordinates = { latitude: -23.5505, longitude: -46.6333 }

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Mapa com os tiles e a atribuição do OpenStreetMap (exigida pela licença ODbL). */
export function createMap(container: HTMLElement, attribution = OSM_ATTRIBUTION): L.Map {
  const map = L.map(container, { scrollWheelZoom: false })
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution }).addTo(map)
  return map
}

export function pin(className: string, label: string) {
  // Montado pelo DOM (e não por string HTML): o label vem de APIs externas e não pode virar markup.
  const span = document.createElement('span')
  span.setAttribute('role', 'img')
  span.setAttribute('aria-label', label)
  span.className = `block size-5 rounded-full border-[3px] border-white shadow-md ${className}`
  return L.divIcon({ className: '', html: span, iconSize: [20, 20], iconAnchor: [10, 10] })
}

export function toLatLng({ latitude, longitude }: Coordinates): L.LatLngTuple {
  return [latitude, longitude]
}

export function toCoordinates(latLng: L.LatLng): Coordinates {
  return { latitude: latLng.lat, longitude: latLng.lng }
}
