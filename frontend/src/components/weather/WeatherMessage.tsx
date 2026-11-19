import type { WeatherResult } from '@/hooks/useWeather'
import type { CultEvent, Weather } from '@/types'

interface WeatherTitleProps {
  eventTime: CultEvent['eventTime']
  forecastType?: Weather['forecastType']
  level: 'h2' | 'h3'
}

export function WeatherTitle({ eventTime, forecastType, level }: Readonly<WeatherTitleProps>) {
  const title =
    forecastType === 'hourly' || (!forecastType && eventTime)
      ? 'Clima no horário do evento'
      : 'Previsão para o dia do evento'

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
      <WeatherTitle eventTime={event.eventTime} level={level} />
      <p aria-live="polite" aria-atomic="true" className="mt-3 text-sm text-muted-foreground">
        {result.status === 'loading' ? 'Consultando a previsão do tempo para o evento…' : result.message}
      </p>
    </div>
  )
}
