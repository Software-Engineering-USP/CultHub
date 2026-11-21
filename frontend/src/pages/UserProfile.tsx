import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import CategoryDot from '@/components/common/CategoryDot'
import Eyebrow from '@/components/common/Eyebrow'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import NotFound from '@/components/common/NotFound'
import Surface from '@/components/common/Surface'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { usePublicProfile } from '@/hooks/usePublicProfile'
import { categories, categoryOrder } from '@/lib/categories'
import { chipClass } from '@/lib/classes'
import { paths } from '@/lib/paths'
import { ApiError } from '@/services/api'
import { formatMemberSince } from '@/services/users'
import type { PublicProfile } from '@/types'

export default function UserProfile() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { profile, loading, error, retry } = usePublicProfile(id, Boolean(user))

  if (authLoading || loading) return <ProfileLoading />
  if (!user) return <SignInRequired />
  if (!profile) {
    if (error instanceof ApiError && error.status === 404) return <ProfileNotFound />
    return <ProfileError message={error?.message} onRetry={retry} />
  }
  return <ProfileContent profile={profile} isMe={profile.id === user.id} />
}

/** Volta para a página anterior (em geral, o evento onde estava o comentário) ou, sem histórico, para a Home. */
function BackButton() {
  const location = useLocation()
  const navigate = useNavigate()
  if (location.key === 'default') {
    return (
      <Button asChild variant="outline">
        <Link to={paths.home}>
          <ArrowLeft /> Voltar ao mapa
        </Link>
      </Button>
    )
  }
  return (
    <Button variant="outline" onClick={() => void navigate(-1)}>
      <ArrowLeft /> Voltar
    </Button>
  )
}

function ProfileContent({ profile, isMe }: Readonly<{ profile: PublicProfile; isMe: boolean }>) {
  useDocumentTitle(`${profile.name} | CultHub`)
  const preferences = categoryOrder.filter((id) => profile.preferences.includes(id))

  return (
    <div className="mx-auto grid max-w-[720px] gap-5">
      <div>
        <BackButton />
      </div>

      <Surface as="section" aria-labelledby="perfil-nome">
        <div className="flex items-center gap-5 max-sm:flex-col max-sm:text-center">
          <InitialsAvatar initials={profile.initials} size="lg" aria-hidden="true" />
          <div className="min-w-0">
            <Eyebrow className="text-[10px] text-muted-foreground">Perfil</Eyebrow>
            <h1 id="perfil-nome" className="mt-1 text-[28px] break-words max-sm:text-[24px]">
              {profile.name}
            </h1>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground max-sm:justify-center">
              <li className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {profile.city || 'Cidade não informada'}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-4" />
                <span>
                  Membro desde{' '}
                  <time dateTime={profile.memberSince}>{formatMemberSince(profile.memberSince)}</time>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <section aria-labelledby="perfil-preferencias" className="mt-7 border-t border-line pt-6">
          <h2 id="perfil-preferencias" className="text-[18px]">
            Preferências culturais
          </h2>
          {preferences.length ? (
            <ul className="mt-4 flex flex-wrap gap-[10px]">
              {preferences.map((id) => (
                <li
                  key={id}
                  className={`inline-flex items-center gap-2 ${chipClass} px-[17px] py-[9px] font-semibold`}
                >
                  <CategoryDot id={id} size="md" />
                  {categories[id].label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              {isMe ? 'Você ainda não escolheu' : 'Ainda não escolheu'} categorias preferidas.
            </p>
          )}
        </section>

        {isMe && (
          <p className="mt-7 border-t border-line pt-5 text-[13px] text-muted-foreground">
            É assim que as outras pessoas veem o seu perfil. E-mail e bairro não aparecem aqui.{' '}
            <Link to={paths.account} className="font-semibold text-maroon underline">
              Editar na Minha conta
            </Link>
          </p>
        )}
      </Surface>
    </div>
  )
}

function ProfileLoading() {
  useDocumentTitle('Perfil | CultHub')
  return <output className="block py-12 text-center text-muted-foreground">Carregando perfil…</output>
}

function SignInRequired() {
  useDocumentTitle('Perfil | CultHub')
  const { pathname, search, hash } = useLocation()
  return (
    <Surface as="section" aria-labelledby="perfil-entrar" className="mx-auto max-w-xl text-center">
      <h1 id="perfil-entrar" className="text-3xl">
        Entre para ver este perfil
      </h1>
      <p className="mt-3 text-muted-foreground">
        Os perfis de outras pessoas só aparecem para quem tem conta.
      </p>
      <Button asChild className="mt-6">
        {/* `replace`: depois do login, o histórico fica [evento, perfil] e o Voltar leva ao evento. */}
        <Link to={paths.signIn} state={{ from: pathname + search + hash }} replace>
          Entrar ou criar conta
        </Link>
      </Button>
    </Surface>
  )
}

function ProfileNotFound() {
  useDocumentTitle('Perfil não encontrado | CultHub')
  return <NotFound message="Este perfil não existe ou a conta foi desativada." />
}

function ProfileError({ message, onRetry }: Readonly<{ message?: string; onRetry: () => void }>) {
  useDocumentTitle('Perfil | CultHub')
  return (
    <section
      role="alert"
      className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center"
    >
      <h1 className="text-2xl">Não foi possível carregar o perfil</h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button onClick={onRetry}>Tentar novamente</Button>
        <Button asChild variant="outline">
          <Link to={paths.home}>Voltar para explorar</Link>
        </Button>
      </div>
    </section>
  )
}
