import type { CultEvent } from '../../data/events'
import { demoWeather } from '../../data/events'
import DemoNote from '../ui/DemoNote'
import Eyebrow from '../ui/Eyebrow'
import { SunIcon } from '../ui/Icons'
import Surface from '../ui/Surface'
import WeatherStats from './WeatherStats'

/** Clima do evento (página de detalhes). */
export default function WeatherCard({ event }: { event: CultEvent }) {
  return (
    <Surface as="section" aria-labelledby="clima-titulo">
      <div className="flex items-center justify-between gap-[14px]">
        <h3 id="clima-titulo" className="text-[17px]">
          Clima no horário do evento
        </h3>
        <Eyebrow className="text-[10px] text-muted">EXEMPLO</Eyebrow>
      </div>

      <div className="mt-6 mb-4 flex items-center gap-[18px]">
        <SunIcon />
        <div>
          <p className="text-[46px] leading-[1.15] font-[650] tracking-[-.06em] text-ink">
            {demoWeather.temperature}
          </p>
          <p className="text-[12px] text-muted">{event.schedule} • exemplo</p>
        </div>
      </div>

      <p>Noite agradável com poucas nuvens e sensação confortável para o trajeto até o {event.venue}.</p>

      <WeatherStats variant="card" />

      <DemoNote>Dados fictícios para ilustrar o layout. Não é uma previsão atual ou em tempo real.</DemoNote>
    </Surface>
  )
}
