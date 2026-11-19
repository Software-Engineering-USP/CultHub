import Eyebrow from '@/components/common/Eyebrow'
import Surface from '@/components/common/Surface'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent } from '@/types'
import WeatherIcon from './WeatherIcon'
import { WeatherMessage, WeatherTitle } from './WeatherMessage'
import WeatherStats from './WeatherStats'

/** Clima do evento (página de detalhes). */
export default function WeatherCard({ event }: Readonly<{ event: CultEvent }>) {
  const result = useWeather(event)
  if (result.status !== 'ready') {
    return (
      <Surface as="section" aria-labelledby="clima-titulo" className="weather-surface">
        <WeatherMessage event={event} result={result} level="h3" />
      </Surface>
    )
  }
  const { weather } = result

  return (
    <Surface
      as="section"
      aria-labelledby="clima-titulo"
      className="weather-surface"
      data-weather={weather.theme}
    >
      <div className="flex items-center justify-between gap-3.5">
        <WeatherTitle eventTime={event.eventTime} forecastType={weather.forecastType} level="h3" />
        <Eyebrow className="text-2xs text-muted-foreground">PREVISÃO</Eyebrow>
      </div>

      <div className="mt-6 mb-4 flex items-center gap-4.5">
        <WeatherIcon weather={weather} className="size-19" />
        <div>
          <p className="text-4xl font-semibold tracking-tighter text-foreground">{weather.temperature}</p>
          <p className="font-semibold text-foreground">{weather.condition}</p>
          <p className="text-xs text-muted-foreground">
            {event.schedule} • {event.venue}
          </p>
        </div>
      </div>

      <WeatherStats weather={weather} variant="card" />
      <p className="text-xs text-muted-foreground">
        Previsão fornecida pelo Open-Meteo; pode mudar conforme a data se aproxima.
      </p>
    </Surface>
  )
}
