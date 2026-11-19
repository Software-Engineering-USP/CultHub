import { generatePath } from 'react-router-dom'

/** Padrões de rota (usados no <Route path> do App). */
export const routes = {
  home: '/',
  signIn: '/entrar',
  recoverPassword: '/recuperar-senha',
  resetPassword: '/redefinir-senha/:uid/:token',
  account: '/conta',
  event: '/eventos/:id',
  eventOrigin: '/eventos/:id/origem',
  eventRoute: '/eventos/:id/rota',
  user: '/usuarios/:id',
} as const

/** Links prontos para <Link to>. */
export const paths = {
  home: routes.home,
  signIn: routes.signIn,
  recoverPassword: routes.recoverPassword,
  resetPassword: (uid: string, token: string) => generatePath(routes.resetPassword, { uid, token }),
  account: routes.account,
  event: (id: string) => generatePath(routes.event, { id }),
  /** `search` (ver lib/origin) leva a origem escolhida entre as páginas "Como chegar". */
  eventOrigin: (id: string, search = '') => generatePath(routes.eventOrigin, { id }) + search,
  eventRoute: (id: string, search = '') => generatePath(routes.eventRoute, { id }) + search,
  /** Perfil público de outra pessoa. */
  user: (id: string) => generatePath(routes.user, { id }),
}
