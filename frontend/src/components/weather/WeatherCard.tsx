import { Sun } from 'lucide-react'
import DemoNote from '@/components/common/DemoNote'
import Eyebrow from '@/components/common/Eyebrow'
import Surface from '@/components/common/Surface'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent } from '@/types'
import WeatherStats from './WeatherStats'

/** Clima do evento (página de detalhes). */
export default function WeatherCard({ event }: { event: CultEvent }) {
  const weather = useWeather(event.id)
  if (!weather) return null

  return (
    <Surface as="section" aria-labelledby="clima-titulo">
      <div className="flex items-center justify-between gap-[14px]">
        <h3 id="clima-titulo" className="text-[17px]">
          Clima no horário do evento
        </h3>
        <Eyebrow className="text-[10px] text-muted-foreground">EXEMPLO</Eyebrow>
      </div>

      <div className="mt-6 mb-4 flex items-center gap-[18px]">
        <Sun strokeWidth={1.5} className="size-12 shrink-0 text-sun" />
        <div>
          <p className="text-[46px] leading-[1.15] font-[650] tracking-[-.06em] text-ink">
            {weather.temperature}
          </p>
          <p className="text-[12px] text-muted-foreground">{event.schedule} • exemplo</p>
        </div>
      </div>

      <p>Noite agradável com poucas nuvens e sensação confortável para o trajeto até o {event.venue}.</p>

      <WeatherStats weather={weather} variant="card" />

      <DemoNote>Dados fictícios para ilustrar o layout. Não é uma previsão atual ou em tempo real.</DemoNote>
    </Surface>
  )
}
