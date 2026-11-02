import { demoRoutes } from '@/data/routes'
import type { RouteOption } from '@/types'

/** Opções de transporte até o local do evento (por enquanto, iguais para todos os eventos). */
export function useRouteOptions(eventId: string | undefined): RouteOption[] {
  return eventId ? demoRoutes : []
}
