import L from 'leaflet'
import type { Coordinates } from '@/types'

/** Centro de São Paulo, usado quando o local do evento não tem coordenadas. */
export const CENTRO_PADRAO: Coordinates = { latitude: -23.5505, longitude: -46.6333 }

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Mapa com os tiles e a atribuição do OpenStreetMap (exigida pela licença ODbL). */
export function createMap(
  container: HTMLElement,
  {
    attribution = OSM_ATTRIBUTION,
    scrollWheelZoom = false,
  }: { attribution?: string; scrollWheelZoom?: boolean } = {},
): L.Map {
  const map = L.map(container, { scrollWheelZoom })
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution }).addTo(map)
  return map
}

// Montados pelo DOM (e não por string HTML): o label vem de APIs externas e não pode virar markup.
function labelled(element: HTMLElement, label: string) {
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', label)
  return element
}

/** Bolinha: a posição de quem usa (partida, "você está aqui"). */
export function pin(className: string, label: string) {
  const span = labelled(document.createElement('span'), label)
  span.className = `block size-5 rounded-full border-[3px] border-white shadow-md ${className}`
  return L.divIcon({ className: '', html: span, iconSize: [20, 20], iconAnchor: [10, 10] })
}

const SVG = 'http://www.w3.org/2000/svg'
// Ícone `location_on` (preenchido) do Material Symbols, do Google, sob licença Apache 2.0:
// github.com/google/material-design-icons, symbols/web/location_on/materialsymbolsoutlined
const MATERIAL_PIN =
  'M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 400Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z'
const SHADE_ID = 'culthub-pin-sombra'

function svgElement(name: string, attributes: Record<string, string>) {
  const element = document.createElementNS(SVG, name)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  return element
}

/** Degradê da metade direita, definido uma vez só na página (todos os pinos usam o mesmo). */
function ensureShade() {
  if (document.getElementById(SHADE_ID)) return
  const defs = svgElement('svg', { width: '0', height: '0', 'aria-hidden': 'true' })
  const gradient = svgElement('linearGradient', { id: SHADE_ID })
  gradient.append(
    svgElement('stop', { offset: '0.5', 'stop-color': 'black', 'stop-opacity': '0' }),
    svgElement('stop', { offset: '0.5', 'stop-color': 'black', 'stop-opacity': '0.15' }),
  )
  const wrapper = svgElement('defs', {})
  wrapper.append(gradient)
  defs.append(wrapper)
  document.body.append(defs)
}

/** Gota com a ponta no lugar: eventos e destinos. A cor vem de uma classe `text-*`. */
function pinSvg(size = 36) {
  const svg = svgElement('svg', {
    viewBox: '0 -960 960 960',
    width: String(size),
    height: String(size),
    'aria-hidden': 'true',
  })
  svg.append(
    svgElement('path', { d: MATERIAL_PIN, fill: 'currentColor', stroke: 'white', 'stroke-width': '36' }),
    // Metade direita mais escura, para dar volume.
    svgElement('path', { d: MATERIAL_PIN, fill: `url(#${SHADE_ID})` }),
    svgElement('circle', { cx: '480', cy: '-560', r: '80', fill: 'white' }),
  )
  return svg
}

/** Gota com a ponta no lugar; em locais agrupados, sobrepõe uma gota por categoria distinta. */
export function markerPin(
  colorClass: string,
  label: string,
  count = 1,
  stackColors: string[] = [colorClass],
) {
  ensureShade()
  const span = labelled(document.createElement('span'), label)
  const colors = [...new Set(stackColors)]
  const stacked = colors.length > 1
  span.className = stacked ? 'relative block' : `relative block drop-shadow-md ${colorClass}`
  let badgeAnchor = span

  if (stacked) {
    colors.slice(0, -1).forEach((color, index) => {
      const layer = document.createElement('span')
      const offset = (index + 1) * 5
      layer.className = `absolute drop-shadow-md ${color}`
      layer.style.left = `${offset}px`
      layer.style.top = `${10 - offset}px`
      layer.style.zIndex = String(index + 1)
      layer.append(pinSvg(42))
      span.append(layer)
    })
    const front = document.createElement('span')
    front.className = `absolute drop-shadow-md ${colors[colors.length - 1]}`
    front.style.left = '0'
    front.style.top = '10px'
    front.style.zIndex = String(colors.length)
    front.append(pinSvg())
    span.append(front)
    badgeAnchor = front
  } else {
    span.append(pinSvg())
  }

  if (count > 1) {
    const badge = document.createElement('span')
    badge.className =
      'absolute -top-1 -left-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-maroon px-1 text-[10px] leading-none font-bold text-white shadow-md'
    badge.textContent = String(count)
    badge.setAttribute('aria-hidden', 'true')
    badgeAnchor.append(badge)
  }
  return L.divIcon({
    className: '',
    html: span,
    iconSize: stacked ? [64, 48] : [36, 36],
    // A ponta da gota frontal permanece exatamente na coordenada do local.
    iconAnchor: stacked ? [18, 43] : [18, 33],
    tooltipAnchor: [0, stacked ? -38 : -28],
  })
}

export function toLatLng({ latitude, longitude }: Coordinates): L.LatLngTuple {
  return [latitude, longitude]
}

export function toCoordinates(latLng: L.LatLng): Coordinates {
  return { latitude: latLng.lat, longitude: latLng.lng }
}
