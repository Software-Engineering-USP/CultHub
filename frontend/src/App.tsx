import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import EventPage from '@/components/events/EventPage'
import Layout from '@/components/layout/Layout'
import { routes } from '@/lib/paths'
import Home from '@/pages/Home'

// A Home vai no arquivo principal (é a primeira tela); as outras páginas
// só são baixadas quando alguém as abre.
const EventDetail = lazy(() => import('@/pages/EventDetail'))
const Origin = lazy(() => import('@/pages/Origin'))
const RoutePlan = lazy(() => import('@/pages/RoutePlan'))
const SignIn = lazy(() => import('@/pages/SignIn'))
const Account = lazy(() => import('@/pages/Account'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path={routes.event}
          element={
            <EventPage
              page={EventDetail}
              notFoundMessage="Este evento não possui uma página de detalhes nesta demonstração."
            />
          }
        />
        <Route
          path={routes.eventOrigin}
          element={
            <EventPage page={Origin} notFoundMessage="Não encontramos o evento para planejar a visita." />
          }
        />
        <Route
          path={routes.eventRoute}
          element={
            <EventPage page={RoutePlan} notFoundMessage="Não encontramos o evento para exibir a rota." />
          }
        />
        <Route path={routes.signIn} element={<SignIn />} />
        <Route path={routes.account} element={<Account />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
