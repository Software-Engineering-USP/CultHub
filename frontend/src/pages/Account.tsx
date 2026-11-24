import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AgendaSection from '@/components/account/AgendaSection'
import AttendanceSection from '@/components/account/AttendanceSection'
import EventGrid from '@/components/account/EventGrid'
import ListStatus from '@/components/account/ListStatus'
import LocalityFields from '@/components/account/LocalityFields'
import type { LocalityServerError } from '@/components/account/LocalityFields'
import MyCommentItem from '@/components/account/MyCommentItem'
import Eyebrow from '@/components/common/Eyebrow'
import Field from '@/components/common/Field'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import SectionHeading from '@/components/common/SectionHeading'
import Surface from '@/components/common/Surface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useAuth } from '@/hooks/useAuth'
import { useUserComments } from '@/hooks/useComments'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSavedEvents } from '@/hooks/useUserEvents'
import { categories } from '@/lib/categories'
import { chipClass, peerFocusRing } from '@/lib/classes'
import { onFormSubmit, text } from '@/lib/forms'
import { formatLocality, normalizePlaceName } from '@/lib/locality'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/services/api'
import type { CategoryId, User } from '@/types'

// Ordem das categorias na tela de preferências
const preferenceOrder: CategoryId[] = ['music', 'theater', 'art', 'festival', 'sport']

const menuLink = 'px-3 text-[12px] font-semibold no-underline hover:bg-accent hover:text-maroon'

const sections = [
  { id: 'dados', label: 'Dados pessoais' },
  { id: 'preferencias', label: 'Preferências culturais' },
  { id: 'salvos', label: 'Eventos salvos' },
  { id: 'agenda', label: 'Minha agenda' },
  { id: 'presencas', label: 'Presenças' },
  { id: 'comentarios', label: 'Meus comentários' },
]
const sectionIds = sections.map((section) => section.id)

const panelHeading = 'mb-[22px] flex items-center justify-between gap-[14px] max-sm:items-start'
const panelEyebrow = 'text-[9px] text-muted-foreground max-sm:max-w-[90px] max-sm:text-right'

export default function Account() {
  useDocumentTitle('Minha conta | CultHub')
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <output className="block">Carregando sua conta...</output>
  if (!user) {
    return (
      <Navigate
        to={paths.signIn}
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    )
  }
  return <AccountContent key={user.id} user={user} />
}

function AccountContent({ user }: Readonly<{ user: User }>) {
  const { updateUser, signOut } = useAuth()
  const navigate = useNavigate()
  const { active: activeSection, select: selectSection } = useActiveSection(sectionIds)
  const savedEvents = useSavedEvents()
  const [profileMessage, setProfileMessage] = useState('')
  const [localityError, setLocalityError] = useState<LocalityServerError | null>(null)
  const [preferencesMessage, setPreferencesMessage] = useState('')
  const [logoutMessage, setLogoutMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<CategoryId[]>(user.preferences)

  const myComments = useUserComments()

  const selectedLabels = preferences.map((id) => categories[id].label).join(' e ')

  return (
    <>
      <SectionHeading
        as="h1"
        variant="page"
        title="Minha conta"
        description="Seu jeito de viver a cultura do Brasil."
      >
        <Button asChild variant="outline">
          <Link to={paths.home}>
            <ArrowLeft /> Voltar ao mapa
          </Link>
        </Button>
      </SectionHeading>

      <div className="grid grid-cols-[276px_minmax(0,1fr)] items-start gap-7 max-md:grid-cols-[minmax(0,1fr)]">
        <Surface
          as="aside"
          aria-label="Perfil e navegação da conta"
          padded={false}
          className="sticky top-6 px-[22px] py-7 text-center max-md:static max-md:text-left max-sm:p-[22px] max-sm:text-center"
        >
          <InitialsAvatar
            initials={user.initials}
            size="lg"
            aria-hidden="true"
            className="mb-4 max-md:float-left max-md:mr-4.5 max-md:size-16 max-sm:float-none max-sm:mr-0 max-sm:mb-3.5"
          />
          <h2 className="mb-[6px] text-[21px]">{user.name}</h2>
          <p className="text-[11px]">{formatLocality(user.city, user.state) || 'Cidade não informada'}</p>
          <Badge variant="success" size="md" className="mt-4 max-md:mt-2.5">
            <span aria-hidden="true" className="size-2 rounded-full bg-current" />
            <span>Conta conectada</span>
          </Badge>

          <nav
            aria-label="Seções da conta"
            className="mt-[25px] grid gap-[5px] border-t border-line pt-5 text-left max-md:clear-both max-md:flex max-md:flex-wrap max-md:gap-[6px] max-sm:flex-col"
          >
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => selectSection(section.id)}
                aria-current={activeSection === section.id ? 'location' : undefined}
                className={cn(
                  menuLink,
                  'rounded-[10px] py-[11px] transition-colors',
                  activeSection === section.id && 'bg-[#f5e8d6] text-maroon hover:bg-[#f5e8d6]',
                )}
              >
                {section.label}
              </a>
            ))}
            <button
              type="button"
              onClick={async () => {
                setLogoutMessage('')
                try {
                  await signOut()
                  navigate(paths.signIn, { replace: true })
                } catch (error) {
                  setLogoutMessage(
                    error instanceof ApiError ? error.message : 'Não foi possível sair. Tente novamente.',
                  )
                }
              }}
              className={`${menuLink} mt-3 rounded-none border-t border-line pt-5 pb-[11px] text-left text-maroon max-md:m-0 max-md:rounded-[10px] max-md:border-0 max-md:py-[11px]`}
            >
              Sair da conta
            </button>
          </nav>
          {logoutMessage && (
            <p role="alert" className="mt-3 text-xs text-maroon">
              {logoutMessage}
            </p>
          )}
        </Surface>

        <div className="grid min-w-0 gap-[26px]">
          <Surface as="section" id="dados" aria-labelledby="dados-titulo">
            <div className={panelHeading}>
              <h2 id="dados-titulo" className="text-[22px]">
                Dados pessoais
              </h2>
              <Eyebrow className={panelEyebrow}>SUA CONTA</Eyebrow>
            </div>

            <form
              key={`${user.id}-${user.name}-${user.city}-${user.state}-${user.district}`}
              aria-label="Editar dados da conta"
              autoComplete="on"
              onSubmit={onFormSubmit(async (data) => {
                setSaving(true)
                setProfileMessage('')
                const city = text(data, 'cidade').trim()
                const state = text(data, 'estado')
                // Sem mudança (a mesma cidade com outra caixa ou sem acento conta como igual), não
                // reenvia: perfil antigo com cidade sem UF ainda salva o resto.
                const localityChanged =
                  state !== user.state || normalizePlaceName(city) !== normalizePlaceName(user.city)
                try {
                  const profile = await api.profile.update({
                    name: text(data, 'nome'),
                    district: text(data, 'bairro'),
                    ...(localityChanged && { locality: { city, state } }),
                  })
                  updateUser(profile)
                  setLocalityError(null)
                  setProfileMessage('Dados atualizados.')
                } catch (error) {
                  // Recusa da cidade ou do estado aparece no campo, com o texto do backend.
                  const locality =
                    error instanceof ApiError ? [error.fields.estado, error.fields.cidade].flat() : []
                  const localityMessage = locality.filter(Boolean).join(' ')
                  setLocalityError(localityMessage ? { city, state, message: localityMessage } : null)
                  let message = 'Não foi possível salvar. Tente novamente.'
                  if (localityMessage) message = 'Não foi possível salvar. Confira o estado e a cidade.'
                  else if (error instanceof ApiError) message = error.message
                  setProfileMessage(message)
                } finally {
                  setSaving(false)
                }
              })}
            >
              <div className="grid grid-cols-2 gap-x-5 max-sm:grid-cols-[minmax(0,1fr)]">
                <Field
                  id="nome"
                  name="nome"
                  label="Nome completo"
                  type="text"
                  defaultValue={user.name}
                  autoComplete="name"
                />
                <Field
                  id="email"
                  label="E-mail"
                  type="email"
                  defaultValue={user.email}
                  readOnly
                  help="O e-mail não pode ser alterado."
                />
                <LocalityFields
                  defaultCity={user.city}
                  defaultState={user.state}
                  serverError={localityError}
                />
                <Field
                  id="bairro"
                  name="bairro"
                  label="Bairro"
                  type="text"
                  defaultValue={user.district}
                  autoComplete="address-level3"
                />
              </div>

              <div className="mt-1 flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-[14px]">
                <p
                  id="dados-aviso"
                  role={profileMessage && profileMessage !== 'Dados atualizados.' ? 'alert' : 'status'}
                  aria-live="polite"
                  className="max-w-[410px] text-xs text-muted-foreground"
                >
                  {profileMessage || 'Seus dados são salvos na sua conta.'}
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar alterações'}
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
            <p className="mt-[-10px] mb-5 text-[12px] text-muted-foreground">
              Categorias que você gosta de acompanhar.{' '}
              {selectedLabels ? `${selectedLabels} selecionadas.` : 'Nenhuma selecionada.'}
            </p>

            <fieldset aria-describedby="preferencias-aviso" className="flex flex-wrap gap-[10px]">
              <legend className="sr-only">Categorias culturais de interesse</legend>
              {preferenceOrder.map((id) => (
                <div key={id} className="relative">
                  <input
                    id={`pref-${id}`}
                    type="checkbox"
                    value={id}
                    checked={preferences.includes(id)}
                    onChange={(event) =>
                      setPreferences((current) =>
                        event.target.checked ? [...current, id] : current.filter((item) => item !== id),
                      )
                    }
                    className="peer absolute top-3 left-[15px] mt-[2px] h-4 w-4 accent-maroon"
                  />
                  <label
                    htmlFor={`pref-${id}`}
                    className={`block ${chipClass} py-[11px] pr-[17px] pl-10 peer-checked:border-[#ba7e48] peer-checked:bg-[#ffe4bc] peer-checked:font-[650] peer-checked:text-maroon ${peerFocusRing}`}
                  >
                    {categories[id].label}
                  </label>
                </div>
              ))}
            </fieldset>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p
                id="preferencias-aviso"
                role={
                  preferencesMessage && preferencesMessage !== 'Preferências atualizadas.'
                    ? 'alert'
                    : 'status'
                }
                aria-live="polite"
                className="text-xs text-muted-foreground"
              >
                {preferencesMessage || 'Salve suas categorias preferidas.'}
              </p>
              <Button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  setPreferencesMessage('')
                  try {
                    const profile = await api.profile.updatePreferences(preferences)
                    updateUser(profile)
                    setPreferences(profile.preferencias)
                    setPreferencesMessage('Preferências atualizadas.')
                  } catch (error) {
                    setPreferencesMessage(
                      error instanceof ApiError ? error.message : 'Não foi possível salvar. Tente novamente.',
                    )
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                Salvar preferências
              </Button>
            </div>
          </Surface>

          <section id="salvos" aria-labelledby="salvos-titulo">
            <SectionHeading
              id="salvos-titulo"
              title="Eventos salvos"
              description={
                savedEvents.loading ? undefined : `${savedEvents.events.length} experiências salvas`
              }
              className="mb-5"
              titleClassName="text-2xl"
            />

            <EventGrid
              {...savedEvents}
              emptyMessage="Você ainda não salvou nenhum evento. Explore o catálogo e salve os que quer acompanhar."
            />
          </section>

          <AgendaSection />
          <AttendanceSection />

          <Surface as="section" id="comentarios" aria-labelledby="comentarios-titulo">
            <div className={panelHeading}>
              <h2 id="comentarios-titulo" className="text-[22px]">
                Meus comentários
              </h2>
            </div>

            <ListStatus
              loading={myComments.loading}
              error={myComments.error}
              empty={!myComments.comments.length}
              emptyMessage="Você ainda não comentou em nenhum evento. Na página de um evento, compartilhe o seu olhar."
            />
            {myComments.comments.map((comment) => (
              <MyCommentItem
                key={comment.id}
                comment={comment}
                onUpdate={myComments.update}
                onRemove={myComments.remove}
              />
            ))}
          </Surface>
        </div>
      </div>
    </>
  )
}
