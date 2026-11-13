import { generatePath } from 'react-router-dom'

/** Padrões de rota (usados no <Route path> do App). */
export const routes = {
  home: '/',
  signIn: '/entrar',
  account: '/conta',
  event: '/eventos/:id',
  eventOrigin: '/eventos/:id/origem',
  eventRoute: '/eventos/:id/rota',
} as const

/** Links prontos para <Link to>. */
export const paths = {
  home: routes.home,
  signIn: routes.signIn,
  account: routes.account,
  event: (id: string) => generatePath(routes.event, { id }),
  /** `search` (ver lib/origin) leva a origem escolhida entre as páginas "Como chegar". */
  eventOrigin: (id: string, search = '') => generatePath(routes.eventOrigin, { id }) + search,
  eventRoute: (id: string, search = '') => generatePath(routes.eventRoute, { id }) + search,
}
