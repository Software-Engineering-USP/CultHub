import { useParams } from 'react-router-dom'
import { findEvent } from '../data/events'
import type { CultEvent } from '../data/events'

/** Evento da rota atual (/eventos/:id/...), se existir. */
export function useEvent(): CultEvent | undefined {
  const { id } = useParams()
  return id ? findEvent(id) : undefined
}
