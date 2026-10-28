import type { CultEvent } from '../../data/events'
import { demoWeather } from '../../data/events'
import DemoNote from '../ui/DemoNote'
import { SunIcon } from '../ui/Icons'
import Surface from '../ui/Surface'
import WeatherStats from './WeatherStats'

/** Faixa de clima no rodapé das páginas de origem e rota. */
export default function WeatherStrip({ event }: { event: CultEvent }) {
  return (
    <Surface
      as="aside"
      aria-label="Condições climáticas fictícias para o horário do evento"
      padded={false}
      className="mt-[26px] flex items-center gap-6 px-[26px] py-[22px] max-lg:gap-[18px] max-md:flex-wrap max-sm:gap-[14px] max-sm:p-[22px]"
    >
      <SunIcon className="h-[38px] w-[38px] shrink-0 max-sm:h-[30px] max-sm:w-[30px]" />
      <div>
        <h2 className="text-[16px] max-sm:text-[13px]">Clima no horário do evento</h2>
        <p className="mt-1 text-[10px] text-muted">
          {event.schedule} • {demoWeather.condition}
        </p>
      </div>
      <span className="mx-auto text-[32px] leading-[1.15] font-[650] tracking-[-.06em] text-ink max-md:mr-0 max-md:ml-auto max-sm:text-[28px]">
        {demoWeather.temperature}
      </span>
      <WeatherStats variant="strip" />
      <DemoNote size="xs" className="mt-1 max-w-[145px] max-md:max-w-[200px] max-sm:max-w-none">
        Exemplo ilustrativo • não é previsão em tempo real.
      </DemoNote>
    </Surface>
  )
}
