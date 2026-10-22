import { Link } from 'react-router-dom'
import EventCard from '../components/events/EventCard'
import Avatar from '../components/ui/Avatar'
import { Button, ButtonLink } from '../components/ui/Button'
import DemoNote from '../components/ui/DemoNote'
import Eyebrow from '../components/ui/Eyebrow'
import Field from '../components/ui/Field'
import SectionHeading from '../components/ui/SectionHeading'
import StatusBadge from '../components/ui/StatusBadge'
import Surface from '../components/ui/Surface'
import TextButton from '../components/ui/TextButton'
import { currentUser, demoComments, findEvent } from '../data/events'
import type { CultEvent } from '../data/events'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { categories } from '../lib/categories'
import type { CategoryId } from '../lib/categories'
import { peerFocusRing } from '../lib/classes'
import { preventSubmit } from '../lib/forms'

// Ordem das categorias na tela de preferências
const preferenceOrder: CategoryId[] = ['music', 'theater', 'art', 'festival', 'sport']

const menuLink = 'px-3 text-[12px] font-semibold no-underline hover:bg-[#f8f0e4]'

const panelHeading = 'mb-[22px] flex items-center justify-between gap-[14px] max-sm:items-start'
const panelEyebrow = 'text-[9px] text-muted max-sm:max-w-[90px] max-sm:text-right'

export default function Account() {
  useDocumentTitle('Minha conta de exemplo | CultHub')

  const savedEvents = currentUser.savedEventIds
    .map((id) => findEvent(id))
    .filter((event): event is CultEvent => event !== undefined)

  const myComment = demoComments.find((comment) => comment.author === currentUser.name)
  const commentEvent = findEvent('sp-jazz-blues-festival')

  const selectedLabels = currentUser.preferences.map((id) => categories[id].label).join(' e ')

  return (
    <>
      <SectionHeading
        as="h1"
        variant="page"
        title="Minha conta"
        description="Seu jeito de viver a cultura de São Paulo."
      >
        <ButtonLink to="/" variant="secondary">
          ← Voltar ao mapa
        </ButtonLink>
      </SectionHeading>

      <div className="grid grid-cols-[276px_minmax(0,1fr)] items-start gap-7 max-md:grid-cols-[minmax(0,1fr)]">
        <Surface
          as="aside"
          aria-label="Perfil e navegação da conta"
          padded={false}
          className="px-[22px] py-7 text-center max-md:text-left max-sm:p-[22px] max-sm:text-center"
        >
          <Avatar size="lg" aria-hidden="true">
            {currentUser.initials}
          </Avatar>
          <h2 className="mb-[6px] text-[21px]">{currentUser.name}</h2>
          <p className="text-[11px]">Perfil fictício • {currentUser.city}</p>
          <StatusBadge tone="green" size="sm" className="mt-4 max-md:mt-[10px]">
            ● Conta conectada (exemplo)
          </StatusBadge>

          <nav
            aria-label="Seções da conta"
            className="mt-[25px] grid gap-[5px] border-t border-line pt-5 text-left max-md:clear-both max-md:flex max-md:flex-wrap max-md:gap-[6px] max-sm:flex-col"
          >
            <a href="#dados" className={`${menuLink} rounded-[10px] bg-[#f5e8d6] py-[11px] text-maroon`}>
              Dados pessoais
            </a>
            <a href="#preferencias" className={`${menuLink} rounded-[10px] py-[11px]`}>
              Preferências culturais
            </a>
            <a href="#salvos" className={`${menuLink} rounded-[10px] py-[11px]`}>
              Eventos salvos
            </a>
            <a href="#comentarios" className={`${menuLink} rounded-[10px] py-[11px]`}>
              Meus comentários
            </a>
            <Link
              to="/entrar"
              className={`${menuLink} mt-3 rounded-none border-t border-line pb-[11px] pt-5 text-maroon max-md:m-0 max-md:rounded-[10px] max-md:border-0 max-md:py-[11px]`}
            >
              Sair da conta <small>(demonstração)</small>
            </Link>
          </nav>

          <DemoNote className="mt-4">
            Não há sessão autenticada. O link de saída apenas abre a tela de entrada.
          </DemoNote>
        </Surface>

        <div className="grid min-w-0 gap-[26px]">
          <Surface as="section" id="dados" aria-labelledby="dados-titulo">
            <div className={panelHeading}>
              <h2 id="dados-titulo" className="text-[22px]">
                Dados pessoais
              </h2>
              <Eyebrow className={panelEyebrow}>DADOS DE EXEMPLO</Eyebrow>
            </div>

            <form
              aria-label="Editar dados fictícios"
              aria-describedby="dados-aviso"
              autoComplete="off"
              onSubmit={preventSubmit}
            >
              <div className="grid grid-cols-2 gap-x-5 max-sm:grid-cols-[minmax(0,1fr)]">
                <Field id="nome" label="Nome completo" type="text" defaultValue={currentUser.name} autoComplete="off" />
                <Field id="email" label="E-mail" type="email" defaultValue={currentUser.email} autoComplete="off" />
                <Field id="cidade" label="Cidade" type="text" defaultValue={currentUser.city} autoComplete="off" />
                <Field id="bairro" label="Bairro" type="text" defaultValue={currentUser.district} autoComplete="off" />
              </div>

              <div className="mt-1 flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-[14px]">
                <DemoNote id="dados-aviso" className="max-w-[410px]">
                  Sua privacidade importa. Este perfil é fictício: os campos são editáveis, mas não são
                  enviados ou salvos. Não insira dados pessoais reais.
                </DemoNote>
                <Button type="submit" disabled>
                  Salvar alterações
                </Button>
              </div>
            </form>
          </Surface>

          <Surface as="section" id="preferencias" aria-labelledby="preferencias-titulo">
            <div className={panelHeading}>
              <h2 id="preferencias-titulo" className="text-[22px]">
                Preferências culturais
              </h2>
            </div>
            <p className="-mt-[10px] mb-5 text-[12px] text-muted">
              Categorias que você gosta de acompanhar. {selectedLabels} selecionadas.
            </p>

            <fieldset aria-describedby="preferencias-aviso" className="flex flex-wrap gap-[10px]">
              <legend className="sr-only">Categorias culturais de interesse</legend>
              {preferenceOrder.map((id) => (
                <div key={id} className="relative">
                  <input
                    id={`pref-${id}`}
                    type="checkbox"
                    defaultChecked={currentUser.preferences.includes(id)}
                    className="peer absolute left-[15px] top-3 mt-[2px] h-4 w-4 accent-maroon"
                  />
                  <label
                    htmlFor={`pref-${id}`}
                    className={`block rounded-[30px] border border-line bg-[#f7f3eb] py-[11px] pl-10 pr-[17px] text-[12px] peer-checked:border-[#ba7e48] peer-checked:bg-[#ffe4bc] peer-checked:font-[650] peer-checked:text-maroon ${peerFocusRing}`}
                  >
                    {categories[id].label}
                  </label>
                </div>
              ))}
            </fieldset>

            <DemoNote id="preferencias-aviso" className="mt-4">
              Seleção visual em CSS. Você pode marcar categorias, mas as escolhas não são salvas e não
              filtram eventos. A seleção inicial acima descreve apenas o exemplo.
            </DemoNote>
          </Surface>

          <section id="salvos" aria-labelledby="salvos-titulo">
            <SectionHeading
              id="salvos-titulo"
              title="Eventos salvos"
              description={`${savedEvents.length} experiências no radar deste perfil fictício`}
              marginClass="mb-5"
              titleClassName="text-[24px]"
            >
              <span className="text-[12px] text-muted">Lista demonstrativa</span>
            </SectionHeading>

            <div className="grid grid-cols-2 gap-[22px] max-sm:grid-cols-[minmax(0,1fr)]">
              {savedEvents.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
          </section>

          <Surface as="section" id="comentarios" aria-labelledby="comentarios-titulo">
            <div className={panelHeading}>
              <h2 id="comentarios-titulo" className="text-[22px]">
                Meus comentários
              </h2>
              <Eyebrow className={panelEyebrow}>EXEMPLO</Eyebrow>
            </div>

            {myComment && commentEvent && (
              <article className="border-b border-line py-[22px]">
                <Link
                  to={`/eventos/${commentEvent.id}`}
                  className="mb-[10px] block text-[13px] font-bold text-maroon underline"
                >
                  {commentEvent.title} ↗
                </Link>
                <p className="text-[13px] leading-[1.8] text-muted">
                  {myComment.author} • Perfil fictício • comentário de exemplo
                </p>
                <p className="mt-[10px] text-[13px] leading-[1.8]">{myComment.text}</p>
                <div className="mt-[10px] flex gap-[18px]">
                  <TextButton disabled aria-describedby="editar-aviso" className="mt-2">
                    Editar
                  </TextButton>
                  <TextButton disabled aria-describedby="editar-aviso" className="mt-2">
                    Excluir
                  </TextButton>
                </div>
              </article>
            )}

            <DemoNote id="editar-aviso" className="mt-[14px]">
              Comentário demonstrativo. Edição e exclusão estão desativadas.
            </DemoNote>
          </Surface>
        </div>
      </div>
    </>
  )
}
