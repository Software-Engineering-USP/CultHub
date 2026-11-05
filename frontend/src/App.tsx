import { Route, Routes } from 'react-router-dom'
import EventPage from '@/components/events/EventPage'
import Layout from '@/components/layout/Layout'
import { routes } from '@/lib/paths'
import Account from '@/pages/Account'
import EventDetail from '@/pages/EventDetail'
import Home from '@/pages/Home'
import NotFoundPage from '@/pages/NotFoundPage'
import Origin from '@/pages/Origin'
import RoutePlan from '@/pages/RoutePlan'
import SignIn from '@/pages/SignIn'

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
