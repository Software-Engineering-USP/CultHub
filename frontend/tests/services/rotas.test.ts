import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/catalog'
import { rotasApi } from '@/services/rotas'

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('rotasApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('busca endereços pelo texto, perto de um ponto', async () => {
    const resultados = [{ rotulo: 'Rua Augusta, 1500', latitude: -23.55, longitude: -46.65 }]
    const fetch = vi.fn().mockResolvedValue(response({ resultados }))
    vi.stubGlobal('fetch', fetch)

    await expect(
      rotasApi.buscarOrigem('  rua augusta ', { latitude: -23.5, longitude: -46.6 }),
    ).resolves.toEqual(resultados)
    expect(fetch).toHaveBeenCalledWith(
      '/api/rotas/origem/busca/?q=rua+augusta&latitude=-23.5&longitude=-46.6',
      { credentials: 'include', signal: undefined },
    )
  })

  it('busca sem coordenada quando não há ponto de referência', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ resultados: [] }))
    vi.stubGlobal('fetch', fetch)
    await rotasApi.buscarOrigem('augusta')
    expect(fetch.mock.calls[0][0]).toBe('/api/rotas/origem/busca/?q=augusta')
  })

  it('devolve o rótulo da reversa, inclusive null', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ rotulo: 'Rua X, Moema' }))
      .mockResolvedValueOnce(response({ rotulo: null }))
    vi.stubGlobal('fetch', fetch)

    await expect(rotasApi.reversa({ latitude: -23.58, longitude: -46.65 })).resolves.toBe('Rua X, Moema')
    await expect(rotasApi.reversa({ latitude: -25, longitude: -40 })).resolves.toBeNull()
    expect(fetch.mock.calls[0][0]).toBe('/api/rotas/origem/reversa/?latitude=-23.58&longitude=-46.65')
  })

  it.each([
    [429, /Muitas consultas seguidas/],
    [502, /serviço de endereços está indisponível/],
    [400, /Não foi possível consultar o endereço/],
  ])('transforma HTTP %i em ApiError com mensagem para a pessoa', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ detail: 'x' }, status)))
    const promise = rotasApi.reversa({ latitude: 0, longitude: 0 })
    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ status, message: expect.stringMatching(message) })
  })
})
