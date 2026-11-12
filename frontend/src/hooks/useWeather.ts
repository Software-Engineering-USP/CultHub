import { useEffect, useState } from 'react'
import { getEventWeather } from '@/services/climate'
import type { CultEvent, Weather } from '@/types'

type WeatherState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; weather: Weather }
  | { key: string; status: 'unavailable'; message: string }

/** Consulta a previsão do evento pela localização e data recebidas do catálogo. */
export function useWeather(event: CultEvent) {
  const latitude = event.weatherLocation?.latitude ?? null
  const longitude = event.weatherLocation?.longitude ?? null
  const city = event.weatherLocation?.city ?? ''
  const hasLocation = event.weatherLocation !== undefined
  const key = [event.id, latitude, longitude, city, event.eventDate, event.eventTime].join(':')
  const [state, setState] = useState<WeatherState>({ key, status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    getEventWeather(
      hasLocation ? { latitude, longitude, city } : undefined,
      event.eventDate,
      event.eventTime,
      controller.signal,
    )
      .then((weather) => setState({ key, status: 'ready', weather }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            status: 'unavailable',
            message: error instanceof Error ? error.message : 'Não foi possível consultar a previsão.',
          })
        }
      })
    return () => controller.abort()
  }, [city, event.eventDate, event.eventTime, event.id, hasLocation, key, latitude, longitude])

  const loadingState: WeatherState = { key, status: 'loading' }
  return state.key === key ? state : loadingState
}
