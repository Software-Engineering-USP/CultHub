import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDeviceLocation } from '@/hooks/useDeviceLocation'
import { fakePermission, pendingGps, restoreGeolocation, stubGeolocation } from '@tests/geolocation'

afterEach(() => {
  restoreGeolocation()
  vi.restoreAllMocks()
})

const ponto = { latitude: -23.6, longitude: -46.7 }

describe('useDeviceLocation', () => {
  describe('ao abrir a página', () => {
    it('com a permissão já dada, traz a posição sem perguntar', async () => {
      const gps = pendingGps()
      stubGeolocation(fakePermission('granted'), gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      expect(result.current.checking).toBe(true)

      await waitFor(() => expect(gps.getCurrentPosition).toHaveBeenCalledOnce())
      act(() => gps.succeed(ponto.latitude, ponto.longitude))

      await waitFor(() => expect(result.current.position).toEqual(ponto))
      expect(result.current.checking).toBe(false)
    })

    it.each([
      ['prompt', fakePermission('prompt')],
      ['denied', fakePermission('denied')],
      ['com erro', new Error('x')],
    ])('com a permissão %s, não chama o GPS', async (_, permission) => {
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())

      await waitFor(() => expect(result.current.checking).toBe(false))
      expect(result.current.position).toBeNull()
      expect(gps.getCurrentPosition).not.toHaveBeenCalled()
    })

    it('sem a API de permissões, não fica conferindo e o botão ainda funciona', async () => {
      const gps = pendingGps()
      stubGeolocation(null, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      expect(result.current.checking).toBe(false)

      act(() => result.current.request())
      act(() => gps.succeed(1, 2))
      await waitFor(() => expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }))
    })

    it('não registra o listener se desmontar antes de a permissão responder', async () => {
      let answer!: (status: PermissionStatus) => void
      const permission = fakePermission('granted')
      const listen = vi.spyOn(permission, 'addEventListener')
      stubGeolocation(fakePermission('prompt'), pendingGps().getCurrentPosition)
      vi.mocked(navigator.permissions.query).mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      const { unmount } = renderHook(() => useDeviceLocation())

      unmount()
      await act(async () => answer(permission))
      expect(listen).not.toHaveBeenCalled()
    })
  })

  describe('request()', () => {
    it('pede a posição, guarda e avisa quem pediu', async () => {
      const gps = pendingGps()
      stubGeolocation(fakePermission('prompt'), gps.getCurrentPosition)
      const onSuccess = vi.fn()
      const { result } = renderHook(() => useDeviceLocation())

      act(() => result.current.request(onSuccess))
      expect(result.current.status).toBe('locating')
      act(() => gps.succeed(1, 2))

      await waitFor(() => expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }))
      expect(result.current.status).toBe('idle')
      expect(onSuccess).toHaveBeenCalledWith({ latitude: 1, longitude: 2 })
    })

    it.each([
      [1, 'denied'],
      [2, 'unavailable'],
    ] as const)('erro %i do GPS vira status "%s"', async (code, status) => {
      const gps = pendingGps()
      stubGeolocation(fakePermission('prompt'), gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())

      act(() => result.current.request())
      act(() => gps.fail(code))
      await waitFor(() => expect(result.current.status).toBe(status))
    })

    it('sem geolocalização no navegador, avisa que não está disponível', () => {
      stubGeolocation(null, null)
      const { result } = renderHook(() => useDeviceLocation())
      act(() => result.current.request())
      expect(result.current.status).toBe('unavailable')
    })
  })

  describe('mudanças na permissão', () => {
    it('aceitar pelo botão faz uma busca de GPS só', async () => {
      const permission = fakePermission('prompt')
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(result.current.checking).toBe(false))

      act(() => result.current.request())
      // O navegador avisa que a permissão mudou antes de o GPS responder.
      act(() => permission.change('granted'))
      act(() => gps.succeed(1, 2))

      await waitFor(() => expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }))
      expect(gps.getCurrentPosition).toHaveBeenCalledOnce()
    })

    it('revogar tira a posição, mesmo quando ela veio do botão', async () => {
      const permission = fakePermission('prompt')
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(result.current.checking).toBe(false))

      act(() => result.current.request())
      act(() => gps.succeed(1, 2))
      await waitFor(() => expect(result.current.position).not.toBeNull())

      act(() => permission.change('denied'))
      expect(result.current.position).toBeNull()
    })

    it('ignora a resposta do GPS pedida antes de a permissão mudar de novo', async () => {
      const permission = fakePermission('denied')
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(result.current.checking).toBe(false))

      act(() => permission.change('granted'))
      act(() => permission.change('denied'))
      await act(async () => gps.succeed(1, 2))

      expect(result.current.position).toBeNull()
    })

    it('liberar nas configurações traz a posição e tira o aviso de negada', async () => {
      const permission = fakePermission('prompt')
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())

      act(() => result.current.request())
      act(() => gps.fail(1))
      await waitFor(() => expect(result.current.status).toBe('denied'))

      act(() => permission.change('granted'))
      act(() => gps.succeed(1, 2))
      await waitFor(() => expect(result.current.position).toEqual({ latitude: 1, longitude: 2 }))
      expect(result.current.status).toBe('idle')
    })

    it('para de ouvir a permissão ao desmontar', async () => {
      const permission = fakePermission('denied')
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result, unmount } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(result.current.checking).toBe(false))

      unmount()
      act(() => permission.change('granted'))
      expect(gps.getCurrentPosition).not.toHaveBeenCalled()
    })
  })

  describe('revisão da #101', () => {
    it('clicar no botão durante a leitura silenciosa termina a checagem', async () => {
      const gps = pendingGps()
      stubGeolocation(fakePermission('granted'), gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(gps.getCurrentPosition).toHaveBeenCalledOnce())
      expect(result.current.checking).toBe(true)

      act(() => result.current.request())
      expect(result.current.checking).toBe(false)
      // A leitura silenciosa, agora superada, termina sem voltar a "conferindo".
      await act(async () => gps.succeed(1, 2, 0))
      expect(result.current.checking).toBe(false)
    })

    it('no StrictMode, registra um listener só e lê o GPS uma vez', async () => {
      const permission = fakePermission('granted')
      const listen = vi.spyOn(permission, 'addEventListener')
      let answer!: (status: PermissionStatus) => void
      const gps = pendingGps()
      stubGeolocation(fakePermission('prompt'), gps.getCurrentPosition)
      vi.mocked(navigator.permissions.query).mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve
          }),
      )
      renderHook(() => useDeviceLocation(), { reactStrictMode: true })

      await act(async () => answer(permission))

      expect(listen).toHaveBeenCalledOnce()
      expect(gps.getCurrentPosition).toHaveBeenCalledOnce()
    })

    it('a leitura silenciosa é rápida e a do botão é precisa', async () => {
      const gps = pendingGps()
      stubGeolocation(fakePermission('granted'), gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(gps.getCurrentPosition).toHaveBeenCalledOnce())
      act(() => result.current.request())

      const [silenciosa, botao] = gps.getCurrentPosition.mock.calls.map((call) => call[2])
      expect(silenciosa).toMatchObject({ enableHighAccuracy: false, maximumAge: 300_000 })
      expect(botao).toMatchObject({ enableHighAccuracy: true })
    })

    it('um pedido superado não libera a vez do pedido mais novo', async () => {
      const permission = fakePermission('prompt')
      const gps = pendingGps()
      stubGeolocation(permission, gps.getCurrentPosition)
      const { result } = renderHook(() => useDeviceLocation())
      await waitFor(() => expect(result.current.checking).toBe(false))

      act(() => result.current.request())
      act(() => result.current.request())
      await act(async () => gps.succeed(1, 1, 0))
      // Se o primeiro tivesse liberado a vez, esta mudança iniciaria outra leitura e descartaria a segunda.
      act(() => permission.change('granted'))
      await act(async () => gps.succeed(2, 2, 1))

      expect(result.current.position).toEqual({ latitude: 2, longitude: 2 })
      expect(gps.getCurrentPosition).toHaveBeenCalledTimes(2)
    })
  })
})
