import type { WeatherResult } from '@/hooks/useWeather'
import type { CultEvent, Weather } from '@/types'

interface WeatherTitleProps {
  eventTime: CultEvent['eventTime']
  eventInProgress?: boolean
  eventEnded?: boolean
  forecastType?: Weather['forecastType']
  level: 'h2' | 'h3'
}

export function WeatherTitle({
  eventTime,
  eventInProgress,
  eventEnded,
  forecastType,
  level,
}: Readonly<WeatherTitleProps>) {
  let title = 'Previsão para o dia do evento'
  if (eventEnded) {
    title = 'Previsão do tempo'
  } else if (eventInProgress) {
    title = forecastType === 'daily' || (!forecastType && !eventTime) ? 'Previsão para hoje' : 'Clima agora'
  } else if (forecastType === 'hourly' || (!forecastType && eventTime)) {
    title = 'Clima no horário do evento'
  }

  return level === 'h2' ? (
    <h2 className="text-base max-sm:text-sm">{title}</h2>
  ) : (
    <h3 id="clima-titulo" className="text-lg">
      {title}
    </h3>
  )
}

export function WeatherMessage({
  event,
  result,
  level,
}: Readonly<{
  event: CultEvent
  result: Exclude<WeatherResult, { status: 'ready' }>
  level: 'h2' | 'h3'
}>) {
  return (
    <div>
      <WeatherTitle
        eventTime={event.eventTime}
        eventInProgress={result.eventInProgress}
        eventEnded={result.status === 'unavailable' ? result.eventEnded : false}
        level={level}
      />
      <p
        aria-live="polite"
        aria-atomic="true"
        className={`${level === 'h2' ? 'mt-1' : 'mt-3'} text-sm text-muted-foreground`}
      >
        {result.status === 'loading' ? 'Consultando a previsão do tempo para o evento…' : result.message}
      </p>
    </div>
  )
}
