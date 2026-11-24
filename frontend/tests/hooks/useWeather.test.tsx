import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeather } from '@/hooks/useWeather'
import { getEventWeather } from '@/services/climate'
import type { CultEvent, Weather } from '@/types'

vi.mock('@/services/climate', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/climate')>()
  return { ...original, getEventWeather: vi.fn() }
})

const event: CultEvent = {
  id: 'evento-1',
  title: 'Show',
  category: 'music',
  description: '',
  venue: 'Parque',
  schedule: '10 de março, 20:00',
  price: 'Gratuito',
  priceValue: 0,
  priceStatus: 'gratuito',
  image: '',
  imageAlt: '',
  weatherLocation: { latitude: -23.55, longitude: -46.63, city: 'São Paulo' },
  eventDate: '2040-03-10',
  eventTime: '20:00:00',
  eventStartsAt: '2040-03-10T20:00:00-03:00',
  eventEndDate: '2040-03-11',
  eventEndTime: '01:00:00',
  eventEndsAt: '2040-03-11T01:00:00-03:00',
  eventTimezone: 'America/Sao_Paulo',
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
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useWeather', () => {
  it('carrega a previsão usando localização, data e horário do evento', async () => {
    vi.useFakeTimers()
    const requestTime = new Date('2040-03-10T18:00:00Z')
    vi.setSystemTime(requestTime)
    getEventWeatherMock.mockResolvedValue(weather)
    const { result } = renderHook(() => useWeather(event))

    expect(result.current.status).toBe('loading')
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toMatchObject({ status: 'ready', weather })
    expect(getEventWeatherMock).toHaveBeenCalledWith(
      event.weatherLocation,
      event.eventDate,
      event.eventTime,
      expect.any(AbortSignal),
      {
        startsAt: event.eventStartsAt,
        endDate: event.eventEndDate,
        endTime: event.eventEndTime,
        endsAt: event.eventEndsAt,
        timeZone: event.eventTimezone,
      },
      expect.any(Date),
    )
    expect(getEventWeatherMock.mock.calls[0][5]).toEqual(requestTime)
  })

  it('não repete a consulta quando recebe o fuso da previsão', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2040-03-10T18:00:00Z'))
    getEventWeatherMock.mockResolvedValue({ ...weather, forecastTimeZone: 'America/Rio_Branco' })

    renderHook(() => useWeather(event))
    await act(async () => {
      await Promise.resolve()
    })

    expect(getEventWeatherMock).toHaveBeenCalledTimes(1)
  })

  it('usa o horário atual quando uma mudança do evento dispara outra consulta', async () => {
    vi.useFakeTimers()
    const firstRequestTime = new Date('2040-03-10T18:00:00Z')
    const secondRequestTime = new Date('2040-03-10T20:00:00Z')
    vi.setSystemTime(firstRequestTime)
    getEventWeatherMock.mockResolvedValue(weather)
    const { rerender } = renderHook(({ currentEvent }) => useWeather(currentEvent), {
      initialProps: { currentEvent: event },
    })
    await act(async () => {
      await Promise.resolve()
    })

    vi.setSystemTime(secondRequestTime)
    await act(async () => {
      rerender({
        currentEvent: { ...event, weatherLocation: { ...event.weatherLocation!, city: 'Campinas' } },
      })
      await Promise.resolve()
    })

    expect(getEventWeatherMock).toHaveBeenCalledTimes(2)
    expect(getEventWeatherMock.mock.calls[1][5]).toEqual(secondRequestTime)
  })

  it('devolve mensagem se a consulta da previsão falhar', async () => {
    getEventWeatherMock.mockRejectedValue(new Error('Serviço indisponível.'))
    const { result } = renderHook(() => useWeather(event))

    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'unavailable', message: 'Serviço indisponível.' }),
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

  it('atualiza a notificação visual quando o evento termina com a página aberta', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2040-03-10T20:00:00Z'))
    const eventoQueTermina = {
      ...event,
      eventDate: '2040-03-10',
      eventTime: '19:00:00',
      eventStartsAt: '2040-03-10T19:00:00Z',
      eventEndDate: '2040-03-10',
      eventEndTime: '20:01:00',
      eventEndsAt: '2040-03-10T20:01:00Z',
      eventTimezone: 'UTC',
    }
    getEventWeatherMock.mockResolvedValue(weather)
    const { result } = renderHook(() => useWeather(eventoQueTermina))

    await act(async () => {})
    expect(result.current.status).toBe('ready')

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current).toMatchObject({
      status: 'unavailable',
      message: 'Este evento já aconteceu; a previsão do tempo não está mais disponível.',
    })
  })

  it('não mostra previsão de antes do evento como clima atual ao começar', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2040-03-10T19:30:00Z'))
    const eventoPrestesaComecar = {
      ...event,
      eventStartsAt: '2040-03-10T20:00:00Z',
      eventEndDate: '2040-03-10',
      eventEndTime: '23:00:00',
      eventEndsAt: '2040-03-10T23:00:00Z',
      eventTimezone: 'UTC',
    }
    let completeRefresh: ((value: Weather) => void) | undefined
    getEventWeatherMock.mockResolvedValueOnce({ ...weather, eventInProgress: false })
    getEventWeatherMock.mockImplementationOnce(() => new Promise((resolve) => (completeRefresh = resolve)))

    const { result } = renderHook(() => useWeather(eventoPrestesaComecar))
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toMatchObject({ status: 'ready', weather: { temperature: '22°C' } })

    await act(async () => {
      vi.advanceTimersByTime(30 * 60_000)
    })

    expect(getEventWeatherMock).toHaveBeenCalledTimes(2)
    expect(result.current).toMatchObject({ status: 'loading', eventInProgress: true })
    await act(async () => completeRefresh?.({ ...weather, eventInProgress: true }))
  })

  it('mantém a última previsão visível enquanto atualiza a hora do clima atual', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2040-03-10T20:30:00Z'))
    const eventoEmAndamento = {
      ...event,
      eventStartsAt: '2040-03-10T20:00:00Z',
      eventEndDate: '2040-03-10',
      eventEndTime: '23:00:00',
      eventEndsAt: '2040-03-10T23:00:00Z',
      eventTimezone: 'UTC',
    }
    let completeRefresh: ((value: Weather) => void) | undefined
    getEventWeatherMock.mockResolvedValueOnce({ ...weather, eventInProgress: true })
    getEventWeatherMock.mockImplementationOnce(() => new Promise((resolve) => (completeRefresh = resolve)))

    const { result } = renderHook(() => useWeather(eventoEmAndamento))
    await act(async () => {})
    expect(result.current).toMatchObject({ status: 'ready', weather: { temperature: '22°C' } })

    await act(async () => {
      vi.advanceTimersByTime(30 * 60_000)
    })

    expect(getEventWeatherMock).toHaveBeenCalledTimes(2)
    expect(result.current).toMatchObject({ status: 'ready', weather: { temperature: '22°C' } })
    await act(async () => completeRefresh?.(weather))
  })
})
