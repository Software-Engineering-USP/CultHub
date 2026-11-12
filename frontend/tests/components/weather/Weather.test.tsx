import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WeatherCard from '@/components/weather/WeatherCard'
import WeatherStrip from '@/components/weather/WeatherStrip'
import { useWeather } from '@/hooks/useWeather'
import type { CultEvent, Weather } from '@/types'

vi.mock('@/hooks/useWeather', () => ({ useWeather: vi.fn() }))

const event: CultEvent = {
  id: 'evento-1',
  title: 'Show',
  category: 'music',
  description: '',
  venue: 'Parque',
  schedule: '10 de março, 20:00',
  price: 'Gratuito',
  priceValue: 0,
  image: '',
  imageAlt: '',
  eventDate: '2040-03-10',
  eventTime: '20:00:00',
}

const hourly: Weather = {
  condition: 'Céu limpo',
  iconSlug: 'clear-day',
  theme: 'clear',
  temperature: '22°C',
  feelsLike: '20°C',
  humidity: '58%',
  wind: '12 km/h',
  precipitation: '30%',
  forecastType: 'hourly',
}

const daily: Weather = {
  condition: 'Nublado',
  iconSlug: 'overcast',
  theme: 'cloudy',
  temperature: '17°–26°C',
  precipitation: '40%',
  forecastType: 'daily',
}

const useWeatherMock = vi.mocked(useWeather)

beforeEach(() => useWeatherMock.mockReset())

describe('WeatherCard', () => {
  it.each([
    [hourly, 'Clima no horário do evento'],
    [daily, 'Previsão para o dia do evento'],
  ] as const)('mostra previsão e ícone no card', (weather, heading) => {
    useWeatherMock.mockReturnValue({ status: 'ready', weather })
    render(<WeatherCard event={event} />)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: heading })).toHaveAttribute('data-weather', weather.theme)
    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      `https://cdn.meteocons.com/3.0.0-next.10/svg/line/${weather.iconSlug}.svg`,
    )
    expect(screen.getByText(weather.temperature)).toBeInTheDocument()
    expect(screen.getByText('Previsão fornecida pelo Open-Meteo; pode mudar conforme a data se aproxima.'))
      .toBeInTheDocument()
  })

  it('mostra carregamento', () => {
    useWeatherMock.mockReturnValue({ status: 'loading' })
    render(<WeatherCard event={event} />)
    expect(screen.getByText('Consultando a previsão para o local do evento…')).toBeInTheDocument()
  })

  it('mostra quando a previsão não está disponível', () => {
    useWeatherMock.mockReturnValue({ status: 'unavailable', message: 'Previsão indisponível.' })
    render(<WeatherCard event={event} />)
    expect(screen.getByText('Previsão indisponível.')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('WeatherStrip', () => {
  it.each([
    [hourly, 'Clima no horário do evento'],
    [daily, 'Previsão para o dia do evento'],
  ] as const)('mostra previsão e gradiente na faixa', (weather, heading) => {
    useWeatherMock.mockReturnValue({ status: 'ready', weather })
    render(<WeatherStrip event={event} />)

    expect(screen.getByRole('complementary', { name: 'Previsão do tempo para o evento' })).toHaveAttribute(
      'data-weather',
      weather.theme,
    )
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('img', { hidden: true })).toHaveAttribute(
      'src',
      `https://cdn.meteocons.com/3.0.0-next.10/svg/line/${weather.iconSlug}.svg`,
    )
    expect(screen.getByText(weather.temperature)).toBeInTheDocument()
  })

  it('mostra carregamento e erros de previsão', () => {
    useWeatherMock.mockReturnValue({ status: 'loading' })
    const { rerender } = render(<WeatherStrip event={event} />)
    expect(screen.getByText('Consultando a previsão do evento…')).toBeInTheDocument()

    useWeatherMock.mockReturnValue({ status: 'unavailable', message: 'Previsão indisponível.' })
    rerender(<WeatherStrip event={event} />)
    expect(screen.getByText('Previsão indisponível.')).toHaveAttribute('aria-live', 'polite')
  })
})
