import { Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Account from './pages/Account'
import EventDetail from './pages/EventDetail'
import Home from './pages/Home'
import NotFoundPage from './pages/NotFoundPage'
import Origin from './pages/Origin'
import RoutePlan from './pages/RoutePlan'
import SignIn from './pages/SignIn'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="eventos/:id" element={<EventDetail />} />
        <Route path="eventos/:id/origem" element={<Origin />} />
        <Route path="eventos/:id/rota" element={<RoutePlan />} />
        <Route path="entrar" element={<SignIn />} />
        <Route path="conta" element={<Account />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
