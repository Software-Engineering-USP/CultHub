import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { Weather } from '@/types'

// Variante monocromática: o desenho vira máscara e a cor vem do texto (`text-ink`). Os ícones coloridos
// misturam nuvens quase brancas com gotas azul-escuras, e nenhum fundo dava contraste para os dois.
const ICONS_URL = 'https://cdn.meteocons.com/3.0.0-next.10/svg/monochrome'

interface WeatherIconProps {
  weather: Weather
  /** Tamanho (classes `size-*`) */
  className?: string
}

/** Decorativo: a condição sempre aparece em texto ao lado. */
export default function WeatherIcon({ weather, className }: Readonly<WeatherIconProps>) {
  const mask = `url(${ICONS_URL}/${weather.iconSlug}.svg) center / contain no-repeat`
  const style: CSSProperties = { mask, WebkitMask: mask }
  return (
    <span
      aria-hidden="true"
      data-icon={weather.iconSlug}
      style={style}
      className={cn('block shrink-0 bg-current text-ink', className)}
    />
  )
}
