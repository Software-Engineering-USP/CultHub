import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventPage from '@/components/events/EventPage'
import { paths, routes } from '@/lib/paths'
import { ApiError, catalogApi } from '@/services/catalog'
import type { EventWithDetails } from '@/types'
import { apiEvent } from '@tests/fixtures/catalog'
import { renderWithRouter } from '@tests/render'

function Page({ event }: { event: EventWithDetails }) {
  return <h1>{event.title}</h1>
}

function renderAt(id: string) {
  return renderWithRouter(
    <Routes>
      <Route
        path={routes.event}
        element={<EventPage page={Page} notFoundMessage="Evento não encontrado no catálogo." />}
      />
    </Routes>,
    { route: paths.event(id) },
  )
}

describe('EventPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('carrega o evento pela URL e passa os dados mapeados à página', async () => {
    const getEvent = vi.spyOn(catalogApi, 'event').mockResolvedValue(apiEvent({ titulo: 'Jazz consultado' }))
    renderAt('6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Jazz consultado' })).toBeInTheDocument()
    expect(getEvent).toHaveBeenCalledWith('6f2da8a0-ccaa-4c27-a260-ec471e7c7ec1', expect.any(AbortSignal))
  })

  it('mostra estado de carregamento enquanto a API responde', async () => {
    let resolve!: (event: ReturnType<typeof apiEvent>) => void
    vi.spyOn(catalogApi, 'event').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    renderAt('event-id')
    expect(screen.getByRole('status')).toHaveTextContent('Carregando evento')

    resolve(apiEvent({ titulo: 'Chegou' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Chegou' })).toBeInTheDocument()
  })

  it('mostra o estado não encontrado quando a API responde 404', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new ApiError('Não encontrado.', 404))
    renderAt('inexistente')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Evento não encontrado no catálogo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para explorar' })).toHaveAttribute('href', paths.home)
  })

  it('mostra falha de servidor/rede sem classificá-la como 404', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('evento')

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
    expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).not.toBeInTheDocument()
  })

  it('não trata uma mensagem que contém 404 como evento inexistente', async () => {
    vi.spyOn(catalogApi, 'event').mockRejectedValue(new Error('Falha temporária (404)'))
    renderAt('evento')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária (404)')
    expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).not.toBeInTheDocument()
  })
})
