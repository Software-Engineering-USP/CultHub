import { paths } from '@/lib/paths'
import type { CultEvent } from '@/types'

/** Link da página de detalhes, ou null quando o evento não tem uma. */
export function eventPath(event: CultEvent): string | null {
  return event.details ? paths.event(event.id) : null
}

/** Nome curto (breadcrumbs, selos), com fallback para o título. */
export function shortName(event: CultEvent): string {
  return event.shortTitle ?? event.title
}
