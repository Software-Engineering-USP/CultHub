import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Account from './pages/Account'
import EventDetail from './pages/EventDetail'
import Home from './pages/Home'
import NotFoundPage from './pages/NotFoundPage'
import Origin from './pages/Origin'
import RoutePlan from './pages/RoutePlan'
import SignIn from './pages/SignIn'
import { routes } from '@/lib/paths'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path={routes.event} element={<EventDetail />} />
        <Route path={routes.eventOrigin} element={<Origin />} />
        <Route path={routes.eventRoute} element={<RoutePlan />} />
        <Route path={routes.signIn} element={<SignIn />} />
        <Route path={routes.account} element={<Account />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
