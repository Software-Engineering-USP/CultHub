import {
  CircleHelp,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Weather } from '@/types'

const icons: Record<string, LucideIcon> = {
  'clear-day': Sun,
  'clear-night': Moon,
  'partly-cloudy-day': CloudSun,
  'partly-cloudy-night': CloudMoon,
  overcast: Cloud,
  'fog-day': CloudFog,
  'fog-night': CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  'partly-cloudy-day-rain': CloudRain,
  snow: CloudSnow,
  'thunderstorms-day-rain': CloudLightning,
  'not-available': CircleHelp,
}

interface WeatherIconProps {
  weather: Weather
  /** Tamanho (classes `size-*`) */
  className?: string
}

/** Decorativo: a condição sempre aparece em texto ao lado. */
export default function WeatherIcon({ weather, className }: Readonly<WeatherIconProps>) {
  const Icon = icons[weather.iconSlug] ?? CircleHelp
  return (
    <Icon
      aria-hidden="true"
      data-icon={weather.iconSlug}
      strokeWidth={1.5}
      className={cn('block shrink-0 text-ink', className)}
    />
  )
}
