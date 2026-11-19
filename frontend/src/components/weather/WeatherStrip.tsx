import Surface from '@/components/common/Surface'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent } from '@/types'
import WeatherIcon from './WeatherIcon'
import { WeatherMessage, WeatherTitle } from './WeatherMessage'
import WeatherStats from './WeatherStats'

/** Faixa de clima no rodapé das páginas de origem e rota. */
export default function WeatherStrip({ event }: Readonly<{ event: CultEvent }>) {
  const result = useWeather(event)

  return (
    <Surface
      as="aside"
      aria-label="Previsão do tempo para o evento"
      data-weather={result.status === 'ready' ? result.weather.theme : undefined}
      className="weather-surface mt-6.5 flex items-center gap-6 px-6.5 py-5.5 max-lg:gap-4.5 max-md:flex-wrap max-sm:gap-3.5 max-sm:p-5.5"
    >
      {result.status === 'ready' ? (
        <>
          <WeatherIcon weather={result.weather} className="size-15 max-sm:size-12" />
          <div>
            <WeatherTitle eventTime={event.eventTime} forecastType={result.weather.forecastType} level="h2" />
            <p className="mt-1 text-2xs text-muted-foreground">
              {event.schedule} • {result.weather.condition}
            </p>
          </div>
          <span className="mx-auto text-3xl font-semibold tracking-tighter text-foreground max-md:mr-0 max-md:ml-auto">
            {result.weather.temperature}
          </span>
          <WeatherStats weather={result.weather} variant="strip" />
          <p className="mt-1 max-w-36 text-xs text-muted-foreground max-md:max-w-50 max-sm:max-w-none">
            Previsão Open-Meteo; pode mudar conforme a data se aproxima.
          </p>
        </>
      ) : (
        <WeatherMessage event={event} result={result} level="h2" />
      )}
    </Surface>
  )
}
