import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { paths } from '@/lib/paths'
import { catalogApi } from '@/services/catalog'
import { apiEvent, apiPage } from '@tests/fixtures/catalog'

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

const id = 'sp-jazz-blues-festival'

describe('rotas', () => {
  beforeEach(() => {
    vi.spyOn(catalogApi, 'events').mockResolvedValue(apiPage([apiEvent()]))
    vi.spyOn(catalogApi, 'event').mockImplementation(async (id) => {
      if (id === 'nao-existe') throw new Error('Não encontrado. (404)')
      return apiEvent({ id, titulo: id === 'derby-paulista' ? 'Evento encontrado' : 'Jazz no Parque' })
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it.each([
    [paths.home, 'Mapa de Eventos'],
    [paths.event(id), 'Jazz no Parque'],
    [paths.eventOrigin(id), 'Como chegar'],
    [paths.eventRoute(id), 'Como chegar'],
    [paths.signIn, 'Seu próximo encontro com a cultura começa aqui.'],
    [paths.account, 'Minha conta'],
    ['/nao-existe', 'Página não encontrada'],
  ])('%s abre a página certa', async (route, title) => {
    renderAt(route)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('abre detalhe de evento cadastrado, independente do id ser da demonstração', async () => {
    renderAt(paths.event('derby-paulista'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Evento encontrado' })).toBeInTheDocument()
  })

  it.each([
    [paths.eventOrigin('nao-existe'), 'Não encontramos o evento para planejar a visita.'],
    [paths.eventRoute('nao-existe'), 'Não encontramos o evento para exibir a rota.'],
  ])('%s para evento inexistente mostra o aviso da página', async (route, message) => {
    renderAt(route)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})
