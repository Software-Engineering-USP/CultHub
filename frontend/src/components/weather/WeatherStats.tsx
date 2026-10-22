import { demoWeather } from '../../data/events'
import { cn } from '../../lib/cn'

interface WeatherStatsProps {
  variant: 'card' | 'strip'
}

export default function WeatherStats({ variant }: WeatherStatsProps) {
  const stats = [
    { label: 'Sensação', value: demoWeather.feelsLike },
    { label: 'Umidade', value: demoWeather.humidity },
    { label: 'Vento', value: demoWeather.wind },
  ]

  return (
    <dl
      className={cn(
        'grid grid-cols-3',
        variant === 'card'
          ? 'mb-4 mt-6 gap-3 border-t border-line pt-5'
          : 'm-0 gap-6 border-x border-line px-6 max-lg:gap-[14px] max-lg:px-4 max-md:flex-1 max-md:border-0 max-md:pl-0 max-sm:w-full max-sm:basis-full max-sm:border-t max-sm:pt-[15px]',
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-[11px] text-muted">{stat.label}</dt>
          <dd className="mt-1 text-[15px] font-[650]">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
