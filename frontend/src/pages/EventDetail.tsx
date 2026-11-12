import { ArrowRight, Calendar, CalendarCheck, Heart, MapPin, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import BackLink from '@/components/common/BackLink'
import DemoNote from '@/components/common/DemoNote'
import IconTile from '@/components/common/IconTile'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import SectionHeading from '@/components/common/SectionHeading'
import Surface from '@/components/common/Surface'
import CommentItem from '@/components/events/CommentItem'
import RoutePreview from '@/components/events/RoutePreview'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import WeatherCard from '@/components/weather/WeatherCard'
import { useComments } from '@/hooks/useComments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { categories } from '@/lib/categories'
import { logDemoAction } from '@/lib/demo'
import { shortName } from '@/lib/events'
import { onFormSubmit, text } from '@/lib/forms'
import { paths } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import type { EventAvailability, EventWithDetails } from '@/types'

const availabilityMessages: Record<EventAvailability, string> = {
  removed: 'Este evento não está mais disponível no catálogo.',
  cancelled: 'Este evento foi cancelado.',
  ended: 'Este evento já foi encerrado.',
}

export default function EventDetail({ event }: { event: EventWithDetails }) {
  const user = useCurrentUser()
  const comments = useComments(event.id)
  const [saved, setSaved] = useState(event.saved ?? false)
  const [attending, setAttending] = useState(event.attending ?? false)
  const [attendanceCount, setAttendanceCount] = useState(event.attendanceCount ?? 0)
  const [actionInProgress, setActionInProgress] = useState<'saved' | 'attendance' | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  useDocumentTitle(`${event.title} | CultHub`)

  const category = categories[event.category]
  const availabilityMessage = event.availability ? availabilityMessages[event.availability] : undefined

  async function toggleSaved() {
    if (!user) {
      setActionMessage('Entre na sua conta para salvar eventos.')
      return
    }
    const nextSaved = !saved
    setActionInProgress('saved')
    setActionMessage('')
    try {
      if (nextSaved) await api.events.save(event.id)
      else await api.events.unsave(event.id)
      setSaved(nextSaved)
      setActionMessage(nextSaved ? 'Evento salvo na sua conta.' : 'Evento removido dos salvos.')
    } catch (error) {
      setActionMessage(
        error instanceof ApiError ? error.message : 'Não foi possível atualizar os eventos salvos.',
      )
    } finally {
      setActionInProgress(null)
    }
  }

  async function toggleAttendance() {
    if (!user) {
      setActionMessage('Entre na sua conta para confirmar presença.')
      return
    }
    const nextAttending = !attending
    setActionInProgress('attendance')
    setActionMessage('')
    try {
      if (nextAttending) await api.events.attend(event.id)
      else await api.events.unattend(event.id)
      setAttending(nextAttending)
      setAttendanceCount((count) => Math.max(0, count + (nextAttending ? 1 : -1)))
      setActionMessage(nextAttending ? 'Presença confirmada.' : 'Presença removida.')
    } catch (error) {
      setActionMessage(error instanceof ApiError ? error.message : 'Não foi possível atualizar sua presença.')
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <>
      <BackLink to={paths.home}>Voltar para explorar</BackLink>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={paths.home}>Explorar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>{category.label}</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{shortName(event)}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="relative mb-8 overflow-hidden rounded-4xl bg-stone-800 after:pointer-events-none after:absolute after:inset-x-0 after:top-11/20 after:bottom-0 after:bg-linear-to-b after:from-transparent after:to-black/40 after:content-[''] max-sm:mb-6 max-sm:rounded-3xl">
        <img
          src={event.image}
          alt={event.imageAlt}
          className="block h-100 w-full object-cover max-md:h-84 max-sm:h-60"
        />
        <Badge size="lg" className="absolute bottom-6 left-7.5 z-1 max-sm:bottom-4 max-sm:left-4">
          {category.label} • {shortName(event)}
        </Badge>
      </div>

      <div className="space-y-12 max-sm:space-y-8.5">
        <section
          aria-labelledby="evento-titulo"
          className="grid grid-cols-[minmax(0,2fr)_minmax(285px,.85fr)] items-start gap-8.5 max-lg:gap-6.5 max-md:grid-cols-1"
        >
          <div>
            <h1 id="evento-titulo" className="max-w-175 text-foreground">
              {event.title}
            </h1>

            {availabilityMessage && (
              <p role="alert" className="mt-4 rounded-xl border border-amber-700/30 bg-amber-50 p-4 text-sm">
                {availabilityMessage}
              </p>
            )}

            <div className="mt-5.5 mb-2 flex flex-wrap gap-2.5">
              <Button
                variant="outline"
                aria-pressed={saved}
                disabled={actionInProgress !== null}
                onClick={() => void toggleSaved()}
              >
                <Heart fill={saved ? 'currentColor' : 'none'} />
                {saved ? 'Salvo' : 'Salvar'}
              </Button>
              <Button
                variant={attending ? 'default' : 'outline'}
                aria-pressed={attending}
                disabled={actionInProgress !== null}
                onClick={() => void toggleAttendance()}
              >
                <CalendarCheck />
                {attending ? 'Vou!' : 'Vou'}
              </Button>
              <Button
                variant="outline"
                onClick={() => logDemoAction('Compartilhar evento', { eventId: event.id })}
              >
                <Share2 />
                Compartilhar
              </Button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
              {attendanceCount} {attendanceCount === 1 ? 'pessoa confirmou' : 'pessoas confirmaram'} presença.
            </p>
            {!user && (
              <p className="mb-2 text-xs text-muted-foreground">
                <Link to={paths.signIn} className="font-semibold text-maroon underline">
                  Entre na sua conta
                </Link>{' '}
                para salvar o evento ou confirmar presença.
              </p>
            )}
            {actionMessage && (
              <p role="status" className="mb-2 text-xs text-muted-foreground">
                {actionMessage}
              </p>
            )}
            <DemoNote>Compartilhar ainda é demonstrativo e só registra a ação no console.</DemoNote>

            <div className="mt-7.5">
              <h2 className="mb-4 text-2xl">Sobre esta experiência</h2>
              <div className="space-y-3.5 leading-relaxed">
                {event.details.about.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>

            <Surface
              as="section"
              aria-labelledby="local-titulo"
              className="mt-6.5 flex gap-4 max-sm:flex-col max-sm:gap-3"
            >
              <IconTile icon={MapPin} />
              <div>
                <h2 id="local-titulo" className="text-2xl">
                  Onde acontece
                </h2>
                <strong className="mt-2.5 block">{event.venue}</strong>
                <p className="mt-2 mb-3 text-sm">
                  O local aparece no mapa ilustrativo do CultHub. Consulte os canais oficiais do espaço para
                  endereço de acesso, acessibilidade e orientações de chegada.
                </p>
                <Button asChild variant="link">
                  <Link to={paths.eventOrigin(event.id)}>
                    Ver local no mapa <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Surface>
          </div>

          <Surface as="aside" aria-label="Preço e planejamento da visita" className="bg-cream">
            <Badge>{category.label}</Badge>
            <p className="mt-5.5 text-4xl font-bold tracking-tighter text-maroon max-md:mt-3.5 max-sm:text-3xl">
              {event.price}
            </p>
            <p className="text-xs text-muted-foreground">Valor cadastrado no catálogo</p>

            <div className="my-6 grid gap-4 border-y border-maroon/10 py-6 text-sm max-md:my-4.5 max-md:flex max-md:flex-wrap max-md:gap-x-8 max-md:gap-y-4.5 max-md:py-4.5">
              <p className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>{event.schedule}</strong>
                  <br />
                  <small>Horário cadastrado no catálogo</small>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <strong>{event.venue}</strong>
              </p>
            </div>

            <Button asChild block>
              <Link to={paths.eventOrigin(event.id)}>
                Planejar minha visita <ArrowRight />
              </Link>
            </Button>
            <DemoNote className="mt-4">
              Conteúdo demonstrativo. Não há venda de ingressos aqui. Confirme programação e valores nos
              canais oficiais antes da visita.
            </DemoNote>
          </Surface>
        </section>

        <section aria-labelledby="clima-rotas-titulo">
          <SectionHeading
            id="clima-rotas-titulo"
            title="Clima e rotas"
            description={`Previsão para o horário do evento e alternativas de rota até o ${event.venue} • Exemplo ilustrativo`}
          />
          <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
            <WeatherCard event={event} />
            <RoutePreview event={event} />
          </div>
        </section>

        <section aria-labelledby="comentarios-titulo">
          <SectionHeading
            id="comentarios-titulo"
            title="Comentários"
            description={`${comments.length} comentários de exemplo • Compartilhe o seu olhar sobre a experiência.`}
          />

          <Surface
            as="form"
            aria-label="Comentário demonstrativo"
            aria-describedby="comentario-aviso"
            onSubmit={onFormSubmit((data, form) => {
              void api.comments.create(event.id, text(data, 'comentario'))
              form.reset()
            })}
            className="mb-5.5"
          >
            <div className="mb-4.5 flex items-center gap-3 text-xs">
              {user ? (
                <>
                  <InitialsAvatar initials={user.initials} size="sm" aria-hidden="true" />
                  <p>
                    Comentando como <strong>{user.name}</strong>
                  </p>
                </>
              ) : (
                <p>Entre na sua conta para comentar.</p>
              )}
            </div>

            <Label className="sr-only" htmlFor="comentario">
              Seu comentário sobre o evento
            </Label>
            <Textarea
              id="comentario"
              name="comentario"
              required
              placeholder="Escreva seu comentário sobre o evento..."
            />

            <div className="mt-3.5 flex items-center justify-between gap-4.5 max-sm:flex-col max-sm:items-start max-sm:gap-3">
              <DemoNote id="comentario-aviso">
                Compartilhe ideias com respeito.
                <br />
                Demonstração: o texto só aparece no console, não é publicado.
              </DemoNote>
              <Button type="submit" className="max-sm:w-full">
                Publicar comentário
              </Button>
            </div>
          </Surface>

          <Surface>
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
            <DemoNote className="mt-5">
              Comentários ilustrativos. Responder e publicar só registram a ação no console.
            </DemoNote>
          </Surface>
        </section>
      </div>
    </>
  )
}
