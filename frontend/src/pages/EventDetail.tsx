import { ArrowRight, Calendar, Heart, MapPin, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import BackLink from '@/components/common/BackLink'
import Breadcrumbs from '@/components/common/Breadcrumbs'
import DemoNote from '@/components/common/DemoNote'
import IconTile from '@/components/common/IconTile'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import NotFound from '@/components/common/NotFound'
import SectionHeading from '@/components/common/SectionHeading'
import Surface from '@/components/common/Surface'
import CommentItem from '@/components/events/CommentItem'
import RoutePreview from '@/components/events/RoutePreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import WeatherCard from '@/components/weather/WeatherCard'
import { useComments } from '@/hooks/useComments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useEvent } from '@/hooks/useEvents'
import { categories } from '@/lib/categories'
import { logDemoAction } from '@/lib/demo'
import { onFormSubmit, text } from '@/lib/forms'
import { paths } from '@/lib/paths'
import { api } from '@/services/api'

export default function EventDetail() {
  const event = useEvent()
  const user = useCurrentUser()
  const comments = useComments(event?.id)
  useDocumentTitle(event ? `${event.title} | CultHub` : 'Evento não encontrado | CultHub')

  if (!event?.details) {
    return <NotFound message="Este evento não possui uma página de detalhes nesta demonstração." />
  }

  const category = categories[event.category]
  const shortName = event.shortTitle ?? event.title

  return (
    <>
      <BackLink to={paths.home}>Voltar para explorar</BackLink>
      <Breadcrumbs
        items={[{ label: 'Explorar', to: paths.home }, { label: category.label }, { label: shortName }]}
      />

      <div className="relative mb-8 overflow-hidden rounded-[32px] bg-[#2b2522] after:pointer-events-none after:absolute after:inset-x-0 after:top-[55%] after:bottom-0 after:bg-linear-to-b after:from-transparent after:to-black/40 after:content-[''] max-sm:mb-6 max-sm:rounded-[22px]">
        <img
          src={event.image}
          alt={event.imageAlt}
          className="block h-[400px] w-full object-cover object-[center_47%] max-md:h-[330px] max-sm:h-[235px]"
        />
        <Badge size="lg" className="absolute bottom-[25px] left-[30px] z-1 max-sm:bottom-4 max-sm:left-4">
          {category.label} • {shortName}
        </Badge>
      </div>

      <div className="space-y-12 max-sm:space-y-[34px]">
        <section
          aria-labelledby="evento-titulo"
          className="grid grid-cols-[minmax(0,2fr)_minmax(285px,.85fr)] items-start gap-[34px] max-lg:gap-[26px] max-md:grid-cols-[minmax(0,1fr)]"
        >
          <div>
            <h1 id="evento-titulo" className="max-w-[700px] text-[40px] text-ink max-sm:text-[32px]">
              {event.title}
            </h1>

            <div className="mt-[22px] mb-2 flex flex-wrap gap-[10px]">
              <Button
                variant="outline"
                aria-describedby="acoes-aviso"
                onClick={() => void api.events.save(event.id)}
              >
                <Heart />
                Salvar
              </Button>
              <Button
                variant="outline"
                aria-describedby="acoes-aviso"
                onClick={() => logDemoAction('Compartilhar evento', { eventId: event.id })}
              >
                <Share2 />
                Compartilhar
              </Button>
            </div>
            <DemoNote id="acoes-aviso">
              Demonstração: salvar e compartilhar só registram a ação no console.
            </DemoNote>

            <div className="mt-[30px]">
              <h2 className="mb-4 text-[23px]">Sobre esta experiência</h2>
              {event.details.about.map((paragraph, index) => (
                <p key={paragraph} className={index > 0 ? 'mt-[14px] leading-[1.8]' : 'leading-[1.8]'}>
                  {paragraph}
                </p>
              ))}
            </div>

            <Surface
              as="section"
              aria-labelledby="local-titulo"
              className="mt-[26px] flex gap-[17px] max-sm:flex-col max-sm:gap-3"
            >
              <IconTile icon={MapPin} />
              <div>
                <h2 id="local-titulo" className="text-[22px]">
                  Onde acontece
                </h2>
                <strong className="mt-[10px] block">{event.venue}</strong>
                <p className="mt-[9px] mb-[13px] text-[13px]">
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

          <Surface as="aside" aria-label="Preço e planejamento da visita" bg="bg-[#fff0d9]">
            <Badge>{category.label}</Badge>
            <p className="mt-[22px] text-[36px] leading-[1.2] font-[750] tracking-[-.04em] text-maroon max-md:mt-[14px] max-sm:text-[32px]">
              {event.price}
            </p>
            <p className="text-[12px] text-muted-foreground">Preço informado no exemplo</p>

            <div className="my-6 grid gap-4 border-y border-[#e8d8bf] py-6 text-[13px] max-md:my-[18px] max-md:flex max-md:flex-wrap max-md:gap-x-8 max-md:gap-y-[18px] max-md:py-[18px]">
              <p className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>{event.schedule}</strong>
                  <br />
                  <small>Horário demonstrativo</small>
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
            className="mb-[22px]"
          >
            <div className="mb-[18px] flex items-center gap-3 text-[12px]">
              <InitialsAvatar initials={user.initials} size="sm" aria-hidden="true" />
              <p>
                Comentando como <strong>{user.name}</strong> • perfil fictício
              </p>
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

            <div className="mt-[14px] flex items-center justify-between gap-[18px] max-sm:flex-col max-sm:items-start max-sm:gap-3">
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
