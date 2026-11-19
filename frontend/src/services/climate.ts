import type { Weather } from '@/types'
import { apiGet } from './catalog'

interface Locality {
  latitude: number
  longitude: number
  country_code?: string
}

interface ForecastResponse {
  hourly?: {
    time: string[]
    temperature_2m: number[]
    relative_humidity_2m: number[]
    apparent_temperature: number[]
    precipitation_probability: number[]
    weather_code: number[]
    wind_speed_10m: number[]
    is_day: number[]
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
  }
}

interface LocalitiesResponse {
  resultados: Locality[]
}

function get<T>(path: string, signal: AbortSignal): Promise<T> {
  return apiGet<T>(path, {
    signal,
    describe: (_status, detail) => detail ?? 'Não foi possível consultar a previsão do tempo.',
  })
}

function diasAteEvento(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const agora = new Date()
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const diaDoEvento = Date.UTC(year, month - 1, day)
  return Math.round((diaDoEvento - hoje) / 86_400_000)
}

function eventoJaPassou(date: string, time?: string | null): boolean {
  const dias = diasAteEvento(date)
  if (dias < 0) return true
  if (dias > 0 || !time) return false
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  const agora = new Date()
  return hour * 60 + minute < agora.getHours() * 60 + agora.getMinutes()
}

async function eventCoordinates(
  location: { latitude: number | null; longitude: number | null; city: string } | undefined,
  signal: AbortSignal,
): Promise<{ latitude: number; longitude: number }> {
  if (
    location &&
    location.latitude !== null &&
    location.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined
  ) {
    return { latitude: location.latitude, longitude: location.longitude }
  }
  if (!location?.city.trim()) throw new Error('O local deste evento não tem coordenadas cadastradas.')

  const params = new URLSearchParams({ nome: location.city, pais: 'BR' })
  const { resultados } = await get<LocalitiesResponse>(`/clima/localidades/?${params}`, signal)
  const locality = resultados.find((item) => item.country_code === 'BR') ?? resultados[0]
  if (!locality) throw new Error('Não encontramos a cidade do evento para consultar o clima.')
  return { latitude: locality.latitude, longitude: locality.longitude }
}

function weatherPresentation(code: number, isDay: boolean) {
  if (code === 0) {
    return { condition: 'Céu limpo', iconSlug: isDay ? 'clear-day' : 'clear-night', theme: 'clear' as const }
  }
  if ([1, 2].includes(code)) {
    return {
      condition: 'Parcialmente nublado',
      iconSlug: isDay ? 'partly-cloudy-day' : 'partly-cloudy-night',
      theme: 'partly-cloudy' as const,
    }
  }
  if (code === 3) return { condition: 'Nublado', iconSlug: 'overcast', theme: 'cloudy' as const }
  if ([45, 48].includes(code)) {
    return {
      condition: 'Neblina',
      iconSlug: isDay ? 'fog-day' : 'fog-night',
      theme: 'fog' as const,
    }
  }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { condition: 'Garoa', iconSlug: 'drizzle', theme: 'rain' as const }
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return {
      condition: [80, 81, 82].includes(code) ? 'Pancadas de chuva' : 'Chuva',
      iconSlug: [80, 81, 82].includes(code) ? 'partly-cloudy-day-rain' : 'rain',
      theme: 'rain' as const,
    }
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return {
      condition: [85, 86].includes(code) ? 'Pancadas de neve' : 'Neve',
      iconSlug: 'snow',
      theme: 'snow' as const,
    }
  }
  if ([95, 96, 99].includes(code)) {
    return { condition: 'Tempestade', iconSlug: 'thunderstorms-day-rain', theme: 'storm' as const }
  }
  return { condition: 'Condição não identificada', iconSlug: 'not-available', theme: 'cloudy' as const }
}

const graus = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function hourlyWeather(forecast: ForecastResponse, date: string, time: string): Weather | undefined {
  const hourly = forecast.hourly
  if (!hourly) return undefined
  const hour = time.slice(0, 2)
  const index = hourly.time.findIndex((value) => value.startsWith(`${date}T${hour}:`))
  if (index < 0) return undefined
  const presentation = weatherPresentation(hourly.weather_code[index], hourly.is_day[index] === 1)

  return {
    ...presentation,
    temperature: `${graus.format(hourly.temperature_2m[index])}°C`,
    feelsLike: `${graus.format(hourly.apparent_temperature[index])}°C`,
    humidity: `${inteiro.format(hourly.relative_humidity_2m[index])}%`,
    wind: `${inteiro.format(hourly.wind_speed_10m[index])} km/h`,
    precipitation: `${inteiro.format(hourly.precipitation_probability[index])}%`,
    forecastType: 'hourly',
  }
}

function dailyWeather(forecast: ForecastResponse, date: string): Weather | undefined {
  const index = forecast.daily.time.indexOf(date)
  if (index < 0) return undefined
  const minimum = forecast.daily.temperature_2m_min[index]
  const maximum = forecast.daily.temperature_2m_max[index]
  const presentation = weatherPresentation(forecast.daily.weather_code[index], true)
  return {
    ...presentation,
    temperature: `${graus.format(minimum)}°–${graus.format(maximum)}°C`,
    precipitation: `${inteiro.format(forecast.daily.precipitation_probability_max[index])}%`,
    forecastType: 'daily',
  }
}

export async function getEventWeather(
  location: { latitude: number | null; longitude: number | null; city: string } | undefined,
  date: string | undefined,
  time: string | null | undefined,
  signal: AbortSignal,
): Promise<Weather> {
  if (!date) throw new Error('A data deste evento não está disponível para consultar a previsão.')
  if (eventoJaPassou(date, time)) {
    throw new Error('Este evento já aconteceu; a previsão do tempo não está mais disponível.')
  }
  const diasRestantes = diasAteEvento(date)
  if (diasRestantes > 15) {
    throw new Error('A previsão estará disponível a partir de 16 dias antes do evento.')
  }
  const { latitude, longitude } = await eventCoordinates(location, signal)
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    dias: String(diasRestantes + 1),
  })
  const forecast = await get<ForecastResponse>(`/clima/previsao/?${params}`, signal)
  const weather = (time && hourlyWeather(forecast, date, time)) || dailyWeather(forecast, date)
  if (weather) return weather
  throw new Error('A previsão para esse dia ainda não está disponível.')
}
