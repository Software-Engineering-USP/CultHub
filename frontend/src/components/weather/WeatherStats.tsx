import { cn } from '@/lib/utils'
import type { Weather } from '@/types'

interface WeatherStatsProps {
  weather: Weather
  variant: 'card' | 'strip'
}

export default function WeatherStats({ weather, variant }: Readonly<WeatherStatsProps>) {
  const stats = [
    { label: 'Sensação', value: weather.feelsLike },
    { label: 'Umidade', value: weather.humidity },
    { label: 'Vento', value: weather.wind },
    { label: weather.forecastType === 'hourly' ? 'Chuva' : 'Chance de chuva', value: weather.precipitation },
  ].filter((stat): stat is { label: string; value: string } => Boolean(stat.value))

  return (
    <dl
      className={cn(
        'grid grid-cols-3',
        variant === 'card'
          ? 'mt-6 mb-4 gap-3 border-t border-border pt-5'
          : 'm-0 gap-6 border-x border-border px-6 max-lg:gap-3.5 max-lg:px-4 max-md:flex-1 max-md:border-0 max-md:pl-0 max-sm:w-full max-sm:basis-full max-sm:border-t max-sm:pt-4',
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="mt-1 text-base font-semibold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
