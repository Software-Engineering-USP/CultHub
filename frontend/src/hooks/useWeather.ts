import { useEffect, useState } from 'react'
import { getEventWeather, getEventWeatherContext } from '@/services/climate'
import type { CultEvent, Weather } from '@/types'

type WeatherState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; weather: Weather }
  | { key: string; status: 'unavailable'; message: string }

export type WeatherResult =
  | { status: 'loading'; eventInProgress?: boolean }
  | { status: 'ready'; weather: Weather }
  | { status: 'unavailable'; message: string; eventInProgress?: boolean }

/** Consulta a previsão do evento pela localização e data recebidas do catálogo. */
export function useWeather(event: CultEvent): WeatherResult {
  const latitude = event.weatherLocation?.latitude ?? null
  const longitude = event.weatherLocation?.longitude ?? null
  const city = event.weatherLocation?.city ?? ''
  const hasLocation = event.weatherLocation !== undefined
  const [clock, setClock] = useState(() => Date.now())
  const timing = {
    startsAt: event.eventStartsAt,
    endDate: event.eventEndDate,
    endTime: event.eventEndTime,
    endsAt: event.eventEndsAt,
    timeZone: event.eventTimezone,
  }
  const eventContext = event.eventDate
    ? getEventWeatherContext(event.eventDate, event.eventTime, timing, new Date(clock))
    : { date: '', time: null, inProgress: false, ended: false }
  const key = [
    event.id,
    latitude,
    longitude,
    city,
    event.eventDate,
    event.eventTime,
    event.eventStartsAt,
    event.eventEndDate,
    event.eventEndTime,
    event.eventEndsAt,
    event.eventTimezone,
    eventContext.ended,
    eventContext.inProgress,
    eventContext.inProgress ? eventContext.date : '',
    eventContext.inProgress && event.eventTime ? eventContext.time?.slice(0, 2) : '',
  ].join(':')
  const [state, setState] = useState<WeatherState>({ key, status: 'loading' })

  useEffect(() => {
    const updateClock = () => setClock(Date.now())
    const interval = window.setInterval(updateClock, 60_000)
    document.addEventListener('visibilitychange', updateClock)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getEventWeather(
      hasLocation ? { latitude, longitude, city } : undefined,
      event.eventDate,
      event.eventTime,
      controller.signal,
      {
        startsAt: event.eventStartsAt,
        endDate: event.eventEndDate,
        endTime: event.eventEndTime,
        endsAt: event.eventEndsAt,
        timeZone: event.eventTimezone,
      },
    )
      .then((weather) => {
        if (!controller.signal.aborted) setState({ key, status: 'ready', weather })
      })
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
  }, [
    city,
    event.eventDate,
    event.eventEndDate,
    event.eventEndTime,
    event.eventEndsAt,
    event.eventStartsAt,
    event.eventTime,
    event.eventTimezone,
    hasLocation,
    key,
    latitude,
    longitude,
  ])

  const loadingState: WeatherState = { key, status: 'loading' }
  const currentState = state.key === key ? state : loadingState
  if (eventContext.ended) {
    return {
      status: 'unavailable',
      message: 'Este evento já aconteceu; a previsão do tempo não está mais disponível.',
      eventInProgress: false,
    }
  }
  if (currentState.status === 'ready') {
    return {
      status: 'ready',
      weather: { ...currentState.weather, eventInProgress: eventContext.inProgress },
    }
  }
  if (currentState.status === 'unavailable') {
    return {
      status: 'unavailable',
      message: currentState.message,
      eventInProgress: eventContext.inProgress,
    }
  }
  return { status: 'loading', eventInProgress: eventContext.inProgress }
}
