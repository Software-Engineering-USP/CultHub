import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { currentUser } from '@/data/user'
import { paths } from '@/lib/paths'
import type { User } from '@/types'
import { AuthTestProvider } from './auth'

/** Renderiza dentro de um router em memória, na rota indicada. */
export function renderWithRouter(
  ui: ReactElement,
  { route = '/', authUser }: { route?: string; authUser?: User | null } = {},
) {
  const initialUser = authUser === undefined ? (route === paths.signIn ? null : currentUser) : authUser

  return {
    user: userEvent.setup(),
    ...render(
      <AuthTestProvider initialUser={initialUser}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthTestProvider>,
    ),
  }
}
