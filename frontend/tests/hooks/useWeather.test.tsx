import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeather } from '@/hooks/useWeather'
import { getEventWeather } from '@/services/climate'
import type { CultEvent, Weather } from '@/types'

vi.mock('@/services/climate', () => ({ getEventWeather: vi.fn() }))

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
  weatherLocation: { latitude: -23.55, longitude: -46.63, city: 'São Paulo' },
  eventDate: '2040-03-10',
  eventTime: '20:00:00',
}

const weather: Weather = {
  condition: 'Céu limpo',
  iconSlug: 'clear-day',
  theme: 'clear',
  temperature: '22°C',
  forecastType: 'hourly',
}

const getEventWeatherMock = vi.mocked(getEventWeather)

beforeEach(() => {
  getEventWeatherMock.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('useWeather', () => {
  it('carrega a previsão usando localização, data e horário do evento', async () => {
    getEventWeatherMock.mockResolvedValue(weather)
    const { result } = renderHook(() => useWeather(event))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', weather }))
    expect(getEventWeatherMock).toHaveBeenCalledWith(
      event.weatherLocation,
      event.eventDate,
      event.eventTime,
      expect.any(AbortSignal),
    )
  })

  it('devolve mensagem se a consulta da previsão falhar', async () => {
    getEventWeatherMock.mockRejectedValue(new Error('Serviço indisponível.'))
    const { result } = renderHook(() => useWeather(event))

    await waitFor(() =>
      expect(result.current).toEqual({ status: 'unavailable', message: 'Serviço indisponível.' }),
    )
  })

  it('mostra carregamento ao trocar de evento enquanto a nova previsão chega', async () => {
    let completeRequest: ((value: Weather) => void) | undefined
    getEventWeatherMock.mockImplementationOnce(() => new Promise((resolve) => (completeRequest = resolve)))
    const { result, rerender } = renderHook(({ currentEvent }) => useWeather(currentEvent), {
      initialProps: { currentEvent: event },
    })
    const nextEvent = { ...event, id: 'evento-2' }
    getEventWeatherMock.mockResolvedValueOnce(weather)

    rerender({ currentEvent: nextEvent })
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', weather }))
    await act(async () => completeRequest?.(weather))
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', weather }))
  })
})
