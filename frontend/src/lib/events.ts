import type { CultEvent } from '@/types'

/** Nome curto (breadcrumbs, selos), com fallback para o título. */
export function shortName(event: CultEvent): string {
  return event.shortTitle ?? event.title
}
