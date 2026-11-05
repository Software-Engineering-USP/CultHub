import type { ComponentType } from 'react'
import NotFound from '@/components/common/NotFound'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEvent } from '@/hooks/useEvents'
import { hasDetails } from '@/lib/events'
import type { EventWithDetails } from '@/types'

interface EventPageProps {
  /** Página mostrada quando o evento da URL existe e tem página própria */
  page: ComponentType<{ event: EventWithDetails }>
  /** Aviso mostrado quando o evento não existe ou não tem página nesta demonstração */
  notFoundMessage: string
}

/**
 * Elemento das rotas /eventos/:id/...: lê o evento da URL e mostra a página
 * ou o aviso de "não encontrado". Assim as páginas já recebem o evento pronto.
 */
export default function EventPage({ page: Page, notFoundMessage }: Readonly<EventPageProps>) {
  const event = useEvent()
  if (!hasDetails(event)) return <EventNotFound message={notFoundMessage} />
  return <Page event={event} />
}

function EventNotFound({ message }: Readonly<{ message: string }>) {
  useDocumentTitle('Evento não encontrado | CultHub')
  return <NotFound message={message} />
}
