import { demoComments } from '@/data/comments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { EventComment } from '@/types'

/** Comentários de um evento. */
export function useComments(eventId: string | undefined): EventComment[] {
  if (!eventId) return []
  return demoComments.filter((comment) => comment.eventId === eventId)
}

/** Comentários escritos pelo usuário atual. */
export function useUserComments(): EventComment[] {
  const user = useCurrentUser()
  return user ? demoComments.filter((comment) => comment.authorId === user.id) : []
}
