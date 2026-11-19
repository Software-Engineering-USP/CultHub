import type { CultEvent, Weather } from '@/types'

export function weatherMomentLabel(event: CultEvent, weather: Weather): string {
  if (!weather.eventInProgress) return event.schedule
  return weather.forecastType === 'hourly' ? 'Agora' : 'Hoje'
}
