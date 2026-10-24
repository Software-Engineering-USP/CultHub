import CommentItem from '../components/events/CommentItem'
import RoutePreview from '../components/events/RoutePreview'
import { Button, ButtonLink } from '../components/ui/Button'
import BackLink from '../components/ui/BackLink'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import CategoryBadge from '../components/ui/CategoryBadge'
import DemoNote from '../components/ui/DemoNote'
import Avatar from '../components/ui/Avatar'
import IconTile from '../components/ui/IconTile'
import { CalendarIcon, PinIcon } from '../components/ui/Icons'
import NotFound from '../components/ui/NotFound'
import SectionHeading from '../components/ui/SectionHeading'
import TextLink from '../components/ui/TextLink'
import Surface from '../components/ui/Surface'
import WeatherCard from '../components/weather/WeatherCard'
import { currentUser, demoComments } from '../data/events'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEvent } from '../hooks/useEvent'
import { categories } from '../lib/categories'
import { inputClass } from '../lib/classes'
import { preventSubmit } from '../lib/forms'

export default function EventDetail() {
  const event = useEvent()
  useDocumentTitle(event ? `${event.title} | CultHub` : 'Evento não encontrado | CultHub')

  if (!event?.details) {
    return <NotFound message="Este evento não possui uma página de detalhes nesta demonstração." />
  }

  const category = categories[event.category]
  const shortName = event.shortTitle ?? event.title

  return (
    <>
      <BackLink to="/">← Voltar para explorar</BackLink>
      <Breadcrumbs
        items={[{ label: 'Explorar', to: '/' }, { label: category.label }, { label: shortName }]}
      />

      <div className="relative mb-8 overflow-hidden rounded-[32px] bg-[#2b2522] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:top-[55%] after:bg-gradient-to-b after:from-transparent after:to-black/40 after:content-[''] max-sm:mb-6 max-sm:rounded-[22px]">
        <img
          src={event.image}
          alt={event.imageAlt}
          className="block h-[400px] w-full object-cover object-[center_47%] max-md:h-[330px] max-sm:h-[235px]"
        />
        <CategoryBadge size="lg" className="absolute bottom-[25px] left-[30px] z-[1] max-sm:bottom-4 max-sm:left-4">
          {category.label} • {shortName}
        </CategoryBadge>
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

            <div className="mb-2 mt-[22px] flex flex-wrap gap-[10px]">
              <Button variant="secondary" disabled aria-describedby="acoes-aviso">
                ♡ Salvar
              </Button>
              <Button variant="secondary" disabled aria-describedby="acoes-aviso">
                ↗ Compartilhar
              </Button>
            </div>
            <DemoNote id="acoes-aviso">
              Demonstração visual: salvar e compartilhar não estão disponíveis.
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
              <IconTile>
                <PinIcon className="h-[23px] w-[23px]" />
              </IconTile>
              <div>
                <h2 id="local-titulo" className="text-[22px]">
                  Onde acontece
                </h2>
                <strong className="mt-[10px] block">{event.venue}</strong>
                <p className="mb-[13px] mt-[9px] text-[13px]">
                  O local aparece no mapa ilustrativo do CultHub. Consulte os canais oficiais do espaço
                  para endereço de acesso, acessibilidade e orientações de chegada.
                </p>
                <TextLink to={`/eventos/${event.id}/origem`}>Ver local no mapa →</TextLink>
              </div>
            </Surface>
          </div>

          <Surface as="aside" aria-label="Preço e planejamento da visita" bg="bg-[#fff0d9]">
            <CategoryBadge>{category.label}</CategoryBadge>
            <p className="mt-[22px] text-[36px] font-[750] leading-[1.2] tracking-[-.04em] text-maroon max-md:mt-[14px] max-sm:text-[32px]">
              {event.price}
            </p>
            <p className="text-[12px] text-muted">Preço informado no exemplo</p>

            <div className="my-6 grid gap-4 border-y border-[#e8d8bf] py-6 text-[13px] max-md:my-[18px] max-md:flex max-md:flex-wrap max-md:gap-x-8 max-md:gap-y-[18px] max-md:py-[18px]">
              <p className="flex items-start gap-2">
                <CalendarIcon />
                <span>
                  <strong>{event.schedule}</strong>
                  <br />
                  <small>Horário demonstrativo</small>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <PinIcon />
                <strong>{event.venue}</strong>
              </p>
            </div>

            <ButtonLink to={`/eventos/${event.id}/origem`} block>
              Planejar minha visita <span aria-hidden="true">→</span>
            </ButtonLink>
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
            description={`${demoComments.length} comentários de exemplo • Compartilhe o seu olhar sobre a experiência.`}
          />

          <Surface
            as="form"
            aria-label="Comentário demonstrativo"
            aria-describedby="comentario-aviso"
            onSubmit={preventSubmit}
            className="mb-[22px]"
          >
            <div className="mb-[18px] flex items-center gap-3 text-[12px]">
              <Avatar size="sm" aria-hidden="true">
                {currentUser.initials}
              </Avatar>
              <p>
                Comentando como <strong>{currentUser.name}</strong> • perfil fictício
              </p>
            </div>

            <label className="sr-only" htmlFor="comentario">
              Seu comentário sobre o evento
            </label>
            <textarea
              id="comentario"
              placeholder="Escreva seu comentário sobre o evento..."
              className={`${inputClass} block min-h-[112px] w-full resize-y`}
            />

            <div className="mt-[14px] flex items-center justify-between gap-[18px] max-sm:flex-col max-sm:items-start max-sm:gap-3">
              <DemoNote id="comentario-aviso">
                Compartilhe ideias com respeito.
                <br />
                Demonstração: o texto não é enviado nem publicado.
              </DemoNote>
              <Button type="submit" disabled className="max-sm:w-full">
                Publicar comentário
              </Button>
            </div>
          </Surface>

          <Surface>
            {demoComments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
            <DemoNote className="mt-5">
              Comentários ilustrativos. Respostas e publicação estão desativadas.
            </DemoNote>
          </Surface>
        </section>
      </div>
    </>
  )
}
