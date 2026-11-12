import { Sun } from 'lucide-react'
import DemoNote from '@/components/common/DemoNote'
import Surface from '@/components/common/Surface'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent } from '@/types'
import WeatherStats from './WeatherStats'

/** Faixa de clima no rodapé das páginas de origem e rota. */
export default function WeatherStrip({ event }: Readonly<{ event: CultEvent }>) {
  const weather = useWeather(event.id)
  if (!weather) return null

  return (
    <Surface
      as="aside"
      aria-label="Condições climáticas fictícias para o horário do evento"
      className="mt-6.5 flex items-center gap-6 px-6.5 py-5.5 max-lg:gap-4.5 max-md:flex-wrap max-sm:gap-3.5 max-sm:p-5.5"
    >
      <Sun strokeWidth={1.5} className="size-9.5 shrink-0 text-sun max-sm:size-7.5" />
      <div>
        <h2 className="text-base max-sm:text-sm">Clima no horário do evento</h2>
        <p className="mt-1 text-2xs text-muted-foreground">
          {event.schedule} • {weather.condition}
        </p>
      </div>
      <span className="mx-auto text-3xl font-semibold tracking-tighter text-foreground max-md:mr-0 max-md:ml-auto">
        {weather.temperature}
      </span>
      <WeatherStats weather={weather} variant="strip" />
      <DemoNote size="xs" className="mt-1 max-w-36 max-md:max-w-50 max-sm:max-w-none">
        Exemplo ilustrativo • não é previsão em tempo real.
      </DemoNote>
    </Surface>
  )
}
