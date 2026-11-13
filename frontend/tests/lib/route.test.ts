import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance, formatDuration, googleMapsUrl, routeMode } from '@/lib/route'

describe('lib/route', () => {
  it('formata distâncias em metros e quilômetros', () => {
    expect(formatDistance(847)).toBe('850 m')
    expect(formatDistance(996)).toBe('1 km')
    expect(formatDistance(6400)).toBe('6,4 km')
    expect(formatDistance(12000)).toBe('12 km')
  })

  it('formata durações em minutos e horas', () => {
    expect(formatDuration(20)).toBe('1 min')
    expect(formatDuration(720)).toBe('12 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(3900)).toBe('1 h 05 min')
  })

  it('monta o link do Google Maps com a partida, o destino em texto e o modo', () => {
    const url = new URL(
      googleMapsUrl({ latitude: -23.6, longitude: -46.7 }, 'Qualistage, Rio de Janeiro', 'ape'),
    )
    expect(url.searchParams.get('origin')).toBe('-23.6,-46.7')
    expect(url.searchParams.get('destination')).toBe('Qualistage, Rio de Janeiro')
    expect(url.searchParams.get('travelmode')).toBe('walking')
  })

  it('só carro e a pé têm rota calculada no backend', () => {
    expect(routeMode('carro').backend).toBe('carro')
    expect(routeMode('ape').backend).toBe('a_pe')
    expect(routeMode('onibus').backend).toBeUndefined()
  })

  it('calcula a distância em linha reta', () => {
    const se = { latitude: -23.5505, longitude: -46.6333 }
    expect(distanceKm(se, se)).toBe(0)
    // Praça da Sé até o Qualistage, no Rio: ~360 km
    expect(Math.round(distanceKm(se, { latitude: -22.98, longitude: -43.36 }))).toBeGreaterThan(330)
  })
})
