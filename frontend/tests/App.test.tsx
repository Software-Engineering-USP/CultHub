import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { paths } from '@/lib/paths'

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

const id = 'sp-jazz-blues-festival'

describe('rotas', () => {
  it.each([
    [paths.home, 'Mapa de Eventos'],
    [paths.event(id), 'São Paulo Jazz & Blues Festival'],
    [paths.eventOrigin(id), 'Como chegar'],
    [paths.eventRoute(id), 'Como chegar'],
    [paths.signIn, 'Seu próximo encontro com a cultura começa aqui.'],
    [paths.account, 'Minha conta'],
    ['/nao-existe', 'Página não encontrada'],
  ])('%s abre a página certa', (route, title) => {
    renderAt(route)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it.each([
    [paths.event('derby-paulista'), 'Este evento não possui uma página de detalhes nesta demonstração.'],
    [paths.eventOrigin('nao-existe'), 'Não encontramos o evento para planejar a visita.'],
    [paths.eventRoute('nao-existe'), 'Não encontramos o evento para exibir a rota.'],
  ])('%s sem página própria mostra o aviso da página', (route, message) => {
    renderAt(route)
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})
