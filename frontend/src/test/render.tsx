import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

/** Renderiza dentro de um router em memória, na rota indicada. */
export function renderWithRouter(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  return {
    user: userEvent.setup(),
    ...render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>),
  }
}
