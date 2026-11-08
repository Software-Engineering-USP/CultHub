import type { ComponentType } from 'react'
import { Link, useParams } from 'react-router-dom'
import NotFound from '@/components/common/NotFound'
import { Button } from '@/components/ui/button'
import { useCatalogEvent } from '@/hooks/useCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { EventWithDetails } from '@/types'
import { paths } from '@/lib/paths'

interface EventPageProps {
  /** Tela exibida depois que o evento da URL é carregado. */
  page: ComponentType<{ event: EventWithDetails }>
  /** Aviso mostrado quando a API informa que o evento não existe. */
  notFoundMessage: string
}

/**
 * Carrega da API o evento correspondente à rota e o entrega à página solicitada.
 */
export default function EventPage({ page: Page, notFoundMessage }: Readonly<EventPageProps>) {
  const { id } = useParams()
  const { event, loading, error } = useCatalogEvent(id)
  if (loading) {
    return <p role="status" className="py-12 text-center text-muted-foreground">Carregando evento…</p>
  }
  if (!event) {
    if (error?.includes('(404)')) return <EventNotFound message={notFoundMessage} />
    return (
      <section
        role="alert"
        className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center"
      >
        <h1 className="text-2xl">Não foi possível carregar o evento</h1>
        <p className="mt-3 text-muted-foreground">{error}</p>
        <Button asChild className="mt-5">
          <Link to={paths.home}>Voltar para explorar</Link>
        </Button>
      </section>
    )
  }
  return <Page event={event} />
}

function EventNotFound({ message }: Readonly<{ message: string }>) {
  useDocumentTitle('Evento não encontrado | CultHub')
  return <NotFound message={message} />
}
