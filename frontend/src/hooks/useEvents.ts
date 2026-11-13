import { useParams } from 'react-router-dom'
import { events, findEvent } from '@/data/events'
import type { CultEvent } from '@/types'

/** Todos os eventos. */
export function useEvents(): CultEvent[] {
  return events
}

/** Um evento pelo id, se existir. */
export function useEventById(id: string | undefined): CultEvent | undefined {
  return id ? findEvent(id) : undefined
}

/** Evento da rota atual (/eventos/:id/...), se existir. */
export function useEvent(): CultEvent | undefined {
  const { id } = useParams()
  return useEventById(id)
}
