import Eyebrow from '@/components/common/Eyebrow'
import Surface from '@/components/common/Surface'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent } from '@/types'
import WeatherStats from './WeatherStats'

/** Clima do evento (página de detalhes). */
export default function WeatherCard({ event }: Readonly<{ event: CultEvent }>) {
  const result = useWeather(event)
  if (result.status !== 'ready') {
    return (
      <Surface as="section" aria-labelledby="clima-titulo" className="weather-surface">
        <h3 id="clima-titulo" className="text-lg">
          {event.eventTime ? 'Clima no horário do evento' : 'Previsão para o dia do evento'}
        </h3>
        <p
          role={result.status === 'unavailable' ? 'status' : undefined}
          className="mt-3 text-sm text-muted-foreground"
        >
          {result.status === 'loading' ? 'Consultando a previsão para o local do evento…' : result.message}
        </p>
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
        <h3 id="clima-titulo" className="text-lg">
          {weather.forecastType === 'hourly' ? 'Clima no horário do evento' : 'Previsão para o dia do evento'}
        </h3>
        <Eyebrow className="text-2xs text-muted-foreground">PREVISÃO</Eyebrow>
      </div>

      <div className="mt-6 mb-4 flex items-center gap-4.5">
        <img
          src={`https://cdn.meteocons.com/3.0.0-next.10/svg/line/${weather.iconSlug}.svg`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          width="76"
          height="76"
          className="size-19 shrink-0"
        />
        <div>
          <p className="text-4xl font-semibold tracking-tighter text-foreground">{weather.temperature}</p>
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
