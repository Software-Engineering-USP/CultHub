import Surface from '@/components/common/Surface'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent } from '@/types'
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
          <img
            src={`https://cdn.meteocons.com/3.0.0-next.10/svg/line/${result.weather.iconSlug}.svg`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            width="60"
            height="60"
            className="size-15 shrink-0 max-sm:size-12"
          />
          <div>
            <h2 className="text-base max-sm:text-sm">
              {result.weather.forecastType === 'hourly'
                ? 'Clima no horário do evento'
                : 'Previsão para o dia do evento'}
            </h2>
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
        <div>
          <h2 className="text-base max-sm:text-sm">
            {event.eventTime ? 'Clima no horário do evento' : 'Previsão para o dia do evento'}
          </h2>
          <p aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-muted-foreground">
            {result.status === 'loading' ? 'Consultando a previsão do evento…' : result.message}
          </p>
        </div>
      )}
    </Surface>
  )
}
