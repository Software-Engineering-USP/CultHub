import { useEffect, useMemo, useState } from 'react'
import { getEventWeather, getEventWeatherContext } from '@/services/climate'
import type { CultEvent, Weather } from '@/types'

type WeatherState =
  | { eventKey: string; key: string; status: 'loading' }
  | { eventKey: string; key: string; status: 'ready'; weather: Weather; inProgress: boolean }
  | { eventKey: string; key: string; status: 'unavailable'; message: string }

export type WeatherResult =
  | { status: 'loading'; eventInProgress?: boolean }
  | { status: 'ready'; weather: Weather }
  | { status: 'unavailable'; message: string; eventInProgress?: boolean; eventEnded?: boolean }

/** Consulta a previsão do evento pela localização e data recebidas do catálogo. */
export function useWeather(event: CultEvent): WeatherResult {
  const latitude = event.weatherLocation?.latitude ?? null
  const longitude = event.weatherLocation?.longitude ?? null
  const city = event.weatherLocation?.city ?? ''
  const hasLocation = event.weatherLocation !== undefined
  const [clock, setClock] = useState(() => Date.now())
  const eventKey = [
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
  ].join(':')
  const eventTiming = useMemo(
    () => ({
      startsAt: event.eventStartsAt,
      endDate: event.eventEndDate,
      endTime: event.eventEndTime,
      endsAt: event.eventEndsAt,
      timeZone: event.eventTimezone,
    }),
    [event.eventEndDate, event.eventEndTime, event.eventEndsAt, event.eventStartsAt, event.eventTimezone],
  )
  const eventContext = event.eventDate
    ? getEventWeatherContext(event.eventDate, event.eventTime, eventTiming, new Date(clock))
    : { date: '', time: null, inProgress: false, ended: false }
  const key = [
    eventKey,
    eventContext.ended,
    eventContext.inProgress,
    eventContext.inProgress ? new Date(clock).toISOString().slice(0, 13) : '',
  ].join(':')
  const [state, setState] = useState<WeatherState>({ eventKey, key, status: 'loading' })

  useEffect(() => {
    const updateClock = () => {
      const now = Date.now()
      setClock((previousClock) => {
        const previousContext = getEventWeatherContext(
          event.eventDate ?? '',
          event.eventTime,
          eventTiming,
          new Date(previousClock),
        )
        const nextContext = getEventWeatherContext(
          event.eventDate ?? '',
          event.eventTime,
          eventTiming,
          new Date(now),
        )
        const contextKey = (context: typeof previousContext) =>
          [
            context.ended,
            context.inProgress,
            context.inProgress ? context.date : '',
            context.inProgress && event.eventTime ? context.time?.slice(0, 2) : '',
          ].join(':')
        return contextKey(previousContext) === contextKey(nextContext) ? previousClock : now
      })
    }
    const interval = window.setInterval(updateClock, 60_000)
    document.addEventListener('visibilitychange', updateClock)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [event.eventDate, event.eventTime, eventKey, eventTiming])

  useEffect(() => {
    const controller = new AbortController()
    getEventWeather(
      hasLocation ? { latitude, longitude, city } : undefined,
      event.eventDate,
      event.eventTime,
      controller.signal,
      eventTiming,
      new Date(),
    )
      .then((weather) => {
        if (!controller.signal.aborted) {
          setState({
            eventKey,
            key,
            status: 'ready',
            weather,
            inProgress: weather.eventInProgress ?? eventContext.inProgress,
          })
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            eventKey,
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
    eventTiming,
    eventKey,
    eventContext.inProgress,
    hasLocation,
    key,
    latitude,
    longitude,
  ])

  const loadingState: WeatherState = { eventKey, key, status: 'loading' }
  const currentState = state.key === key ? state : loadingState
  if (eventContext.ended) {
    return {
      status: 'unavailable',
      message: 'Este evento já aconteceu; a previsão do tempo não está mais disponível.',
      eventInProgress: false,
      eventEnded: true,
    }
  }
  if (currentState.status === 'ready') {
    return {
      status: 'ready',
      weather: { ...currentState.weather, eventInProgress: eventContext.inProgress },
    }
  }
  if (
    state.eventKey === eventKey &&
    state.status === 'ready' &&
    state.inProgress === eventContext.inProgress
  ) {
    return {
      status: 'ready',
      weather: { ...state.weather, eventInProgress: eventContext.inProgress },
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
