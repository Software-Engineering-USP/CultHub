import { demoWeather } from '@/data/weather'
import type { Weather } from '@/types'

/** Previsão do tempo para o horário do evento (por enquanto, igual para todos os eventos). */
export function useWeather(eventId: string | undefined): Weather | undefined {
  return eventId ? demoWeather : undefined
}
