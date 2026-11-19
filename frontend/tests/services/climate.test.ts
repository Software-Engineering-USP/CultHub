import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEventWeather } from '@/services/climate'

const date = '2040-03-10'
const location = { latitude: -23.55, longitude: -46.63, city: 'São Paulo' }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function forecast(code: number, isDay = 1, forecastDate = date, forecastTime = '20:00') {
  return {
    hourly: {
      time: [`${forecastDate}T${forecastTime}`],
      temperature_2m: [22],
      relative_humidity_2m: [58],
      apparent_temperature: [20],
      precipitation_probability: [30],
      weather_code: [code],
      wind_speed_10m: [12],
      is_day: [isDay],
    },
    daily: {
      time: [forecastDate],
      weather_code: [code],
      temperature_2m_max: [26],
      temperature_2m_min: [17],
      precipitation_probability_max: [40],
    },
  }
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn()
  for (const response of responses) fetchMock.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2040-03-07T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getEventWeather', () => {
  it.each([
    [0, 1, 'Céu limpo', 'clear-day', 'clear'],
    [0, 0, 'Céu limpo', 'clear-night', 'clear'],
    [1, 1, 'Parcialmente nublado', 'partly-cloudy-day', 'partly-cloudy'],
    [3, 1, 'Nublado', 'overcast', 'cloudy'],
    [45, 1, 'Neblina', 'fog-day', 'fog'],
    [53, 1, 'Garoa', 'drizzle', 'rain'],
    [63, 1, 'Chuva', 'rain', 'rain'],
    [80, 1, 'Pancadas de chuva', 'partly-cloudy-day-rain', 'rain'],
    [71, 1, 'Neve', 'snow', 'snow'],
    [86, 1, 'Pancadas de neve', 'snow', 'snow'],
    [95, 1, 'Tempestade', 'thunderstorms-day-rain', 'storm'],
    [999, 1, 'Condição não identificada', 'not-available', 'cloudy'],
  ] as const)(
    'mapeia a condição %s para a apresentação correta',
    async (code, isDay, condition, iconSlug, theme) => {
      mockFetch(jsonResponse(forecast(code, isDay)))

      const weather = await getEventWeather(location, date, '20:00', new AbortController().signal)

      expect(weather).toMatchObject({
        condition,
        iconSlug,
        theme,
        temperature: '22°C',
        forecastType: 'hourly',
      })
    },
  )

  it('usa o resumo diário quando o evento não tem horário', async () => {
    mockFetch(jsonResponse(forecast(3)))

    const weather = await getEventWeather(location, date, null, new AbortController().signal)

    expect(weather).toMatchObject({
      condition: 'Nublado',
      temperature: '17°–26°C',
      precipitation: '40%',
      forecastType: 'daily',
    })
    expect(weather).not.toHaveProperty('humidity')
  })

  it('usa a busca de localidades quando o evento não tem coordenadas', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ resultados: [{ latitude: -23.55, longitude: -46.63, country_code: 'BR' }] }),
      jsonResponse(forecast(0)),
    )

    await getEventWeather(
      { latitude: null, longitude: null, city: 'São Paulo' },
      date,
      '20:00',
      new AbortController().signal,
    )

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/clima/localidades/?nome=S%C3%A3o+Paulo&pais=BR',
    )
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/api/clima/previsao/?latitude=-23.55&longitude=-46.63&dias=16',
    )
  })

  it('solicita sempre os 16 dias para aproveitar o cache compartilhado', async () => {
    const otherDate = '2040-03-12'
    const fetchMock = mockFetch(jsonResponse(forecast(0)), jsonResponse(forecast(0, 1, otherDate)))

    await getEventWeather(location, date, '20:00', new AbortController().signal)
    await getEventWeather(location, otherDate, '20:00', new AbortController().signal)

    const requestUrls = fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://localhost'))
    expect(requestUrls.map((url) => url.searchParams.get('dias'))).toEqual(['16', '16'])
  })

  it('usa o primeiro resultado se a busca não devolver código de país', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ resultados: [{ latitude: -23.55, longitude: -46.63 }] }),
      jsonResponse(forecast(0)),
    )

    await getEventWeather(
      { latitude: null, longitude: null, city: 'São Paulo' },
      date,
      '20:00',
      new AbortController().signal,
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('informa quando não há local ou cidade para consultar', async () => {
    const signal = new AbortController().signal
    await expect(getEventWeather(undefined, date, '20:00', signal)).rejects.toThrow('não tem coordenadas')
    await expect(
      getEventWeather({ latitude: null, longitude: null, city: '  ' }, date, '20:00', signal),
    ).rejects.toThrow('não tem coordenadas')
  })

  it('informa quando a geocodificação não encontra a cidade', async () => {
    mockFetch(jsonResponse({ resultados: [] }))

    await expect(
      getEventWeather(
        { latitude: null, longitude: null, city: 'Cidade inexistente' },
        date,
        '20:00',
        new AbortController().signal,
      ),
    ).rejects.toThrow('Não encontramos a cidade')
  })

  it('informa quando falta a data ou a previsão ainda não está disponível', async () => {
    const signal = new AbortController().signal
    await expect(getEventWeather(location, undefined, '20:00', signal)).rejects.toThrow('data deste evento')
    mockFetch(jsonResponse({ daily: { time: [] } }))
    await expect(getEventWeather(location, date, '20:00', signal)).rejects.toThrow(
      'O serviço oferece previsão para até 16 dias',
    )
  })

  it('não consulta o serviço para eventos encerrados', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.setSystemTime(new Date('2040-03-07T12:00:00Z'))

    await expect(
      getEventWeather(location, '2040-03-06', '20:00', new AbortController().signal),
    ).rejects.toThrow('Este evento já aconteceu')
    await expect(
      getEventWeather(location, '2040-03-07', '20:00', new AbortController().signal, {
        timeZone: 'UTC',
        endDate: '2040-03-07',
        endTime: '11:00',
      }),
    ).rejects.toThrow('Este evento já aconteceu')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mostra a previsão de hoje para um evento em andamento', async () => {
    vi.setSystemTime(new Date('2040-03-07T12:00:00Z'))
    mockFetch(jsonResponse(forecast(3, 1, '2040-03-07')))

    const weather = await getEventWeather(location, '2040-03-06', '20:00', new AbortController().signal, {
      startsAt: '2040-03-06T20:00:00Z',
      endDate: '2040-03-10',
      endTime: '22:00',
      timeZone: 'UTC',
    })

    expect(weather.forecastType).toBe('daily')
  })

  it('usa o fuso do evento em vez do fuso do navegador', async () => {
    vi.setSystemTime(new Date('2040-03-07T03:30:00Z'))
    mockFetch(jsonResponse(forecast(0, 1, '2040-03-06', '23:00')))

    const weather = await getEventWeather(location, '2040-03-06', '23:00', new AbortController().signal, {
      timeZone: 'America/Rio_Branco',
    })

    expect(weather.forecastType).toBe('hourly')
  })

  it('usa o resumo diário se o horário não aparecer nos dados horários', async () => {
    const dados = forecast(0)
    dados.hourly.time = [`${date}T10:00`]
    mockFetch(jsonResponse(dados))

    const weather = await getEventWeather(location, date, '20:00', new AbortController().signal)

    expect(weather.forecastType).toBe('daily')
  })

  it('exibe a mensagem devolvida pelo serviço quando a consulta falha', async () => {
    mockFetch(jsonResponse({ detail: 'Serviço indisponível.' }, 502))

    await expect(getEventWeather(location, date, '20:00', new AbortController().signal)).rejects.toThrow(
      'Serviço indisponível.',
    )
  })

  it('usa uma mensagem padrão quando a resposta de erro não é JSON', async () => {
    mockFetch(new Response('indisponível', { status: 502 }))

    await expect(getEventWeather(location, date, '20:00', new AbortController().signal)).rejects.toThrow(
      'Não foi possível consultar a previsão do tempo.',
    )
  })

  it('mantém uma mensagem amigável para erros de validação 4xx', async () => {
    mockFetch(jsonResponse({ latitude: ['Latitude inválida.'] }, 400))

    await expect(getEventWeather(location, date, '20:00', new AbortController().signal)).rejects.toThrow(
      'Não foi possível consultar a previsão do tempo.',
    )
  })
})
