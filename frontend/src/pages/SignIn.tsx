import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import BackLink from '@/components/common/BackLink'
import CategoryDot from '@/components/common/CategoryDot'
import Eyebrow from '@/components/common/Eyebrow'
import Field from '@/components/common/Field'
import Surface from '@/components/common/Surface'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { checkboxClass } from '@/lib/classes'
import { onFormSubmit, text } from '@/lib/forms'
import { paths } from '@/lib/paths'
import { ApiError } from '@/services/api'

const panelClass = 'p-7 max-lg:p-[22px]'

function errorText(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível conectar ao CultHub. Confira se o servidor está ativo e tente novamente.'
}

export default function SignIn() {
  useDocumentTitle('Entrar ou criar conta | CultHub')
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const [loginMessage, setLoginMessage] = useState('')
  const [signupMessage, setSignupMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={paths.account} replace />

  return (
    <>
      <BackLink to={paths.home}>Continuar como visitante</BackLink>
      <div className="mt-3 mb-[30px] max-sm:mt-1">
        <h1 className="max-w-[850px] max-md:text-[32px] max-sm:text-[30px]">
          Seu próximo encontro com a cultura começa aqui.
        </h1>
        <p className="mt-3 text-muted-foreground max-sm:text-[13px]">
          Entre ou crie uma conta para manter seus dados e preferências culturais.
        </p>
      </div>

      <div className="grid grid-cols-[.85fr_1fr_1fr] items-stretch gap-[22px] max-lg:grid-cols-[.8fr_1fr_1fr] max-lg:gap-4 max-md:grid-cols-[minmax(0,1fr)]">
        <aside
          aria-labelledby="radar-titulo"
          className="overflow-hidden rounded-[25px] border border-line bg-[#ecdfca] max-md:grid max-md:grid-cols-2 max-sm:block"
        >
          <img
            src="/assets/jazz-source.png"
            alt="Palco de jazz com iluminação acolhedora"
            className="block h-[205px] w-full object-cover max-md:h-full max-md:min-h-[260px] max-sm:h-[210px] max-sm:min-h-0"
          />
          <div className="p-[26px] max-lg:p-[22px] max-md:p-[30px] max-sm:p-[26px]">
            <Eyebrow className="text-[10px]">SEU RADAR CULTURAL</Eyebrow>
            <h2 id="radar-titulo" className="my-4 text-[27px]">
              São Paulo tem muito para descobrir.
            </h2>
            <p className="text-[13px]">Música, teatro, arte e encontros. Crie sua conta para começar.</p>
            <div aria-hidden="true" className="mt-[25px] flex gap-[9px]">
              <CategoryDot id="music" size="md" />
              <CategoryDot id="theater" size="md" />
              <CategoryDot id="art" size="md" />
              <CategoryDot id="sport" size="md" />
              <CategoryDot id="festival" size="md" />
            </div>
          </div>
        </aside>

        <Surface as="section" aria-labelledby="login-titulo" padded={false} className={panelClass}>
          <h2 id="login-titulo" className="text-[23px]">
            Bem-vindo de volta
          </h2>
          <p className="mt-[7px] mb-6 text-[12px]">Entre na sua conta CultHub.</p>
          <form
            aria-label="Entrar"
            autoComplete="on"
            onSubmit={onFormSubmit(async (data) => {
              setSubmitting(true)
              setLoginMessage('')
              try {
                await signIn({
                  email: text(data, 'email'),
                  password: text(data, 'senha'),
                  remember: data.has('lembrar'),
                })
                navigate(paths.account, { replace: true })
              } catch (error) {
                setLoginMessage(errorText(error))
              } finally {
                setSubmitting(false)
              }
            })}
          >
            <Field
              id="login-email"
              required
              name="email"
              label="E-mail"
              type="email"
              placeholder="voce@exemplo.com"
              inputMode="email"
              autoComplete="username"
            />
            <Field
              id="login-senha"
              required
              name="senha"
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              autoComplete="current-password"
            />
            <div className="mt-1 mb-5 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-start gap-2 text-[11px]" htmlFor="lembrar">
                <input id="lembrar" name="lembrar" type="checkbox" className={checkboxClass} />
                <span>Lembrar de mim</span>
              </label>
              <span className="text-xs text-muted-foreground">Recuperação de senha indisponível</span>
            </div>
            <Button type="submit" block disabled={submitting}>
              Entrar <ArrowRight />
            </Button>
            <p
              role={loginMessage ? 'alert' : undefined}
              aria-live="polite"
              className="mt-[14px] text-xs text-muted-foreground"
            >
              {loginMessage || 'A sessão será mantida conforme a opção “Lembrar de mim”.'}
            </p>
          </form>
        </Surface>

        <Surface as="section" aria-labelledby="cadastro-titulo" padded={false} className={panelClass}>
          <h2 id="cadastro-titulo" className="text-[23px]">
            Primeira vez por aqui?
          </h2>
          <p className="mt-[7px] mb-6 text-[12px]">Crie sua conta CultHub.</p>
          <form
            aria-label="Criar conta"
            autoComplete="on"
            onSubmit={onFormSubmit(async (data) => {
              setSubmitting(true)
              setSignupMessage('')
              try {
                await signUp({
                  name: text(data, 'nome'),
                  email: text(data, 'email'),
                  password: text(data, 'senha'),
                  acceptedTerms: data.has('termos'),
                })
                navigate(paths.account, { replace: true })
              } catch (error) {
                setSignupMessage(errorText(error))
              } finally {
                setSubmitting(false)
              }
            })}
          >
            <Field
              id="cadastro-nome"
              required
              name="nome"
              label="Nome"
              type="text"
              placeholder="Como você quer ser chamado?"
              autoComplete="name"
            />
            <Field
              id="cadastro-email"
              required
              name="email"
              label="E-mail"
              type="email"
              placeholder="voce@exemplo.com"
              inputMode="email"
              autoComplete="email"
            />
            <Field
              id="cadastro-senha"
              required
              name="senha"
              label="Senha"
              type="password"
              placeholder="Crie uma senha"
              minLength={8}
              autoComplete="new-password"
              help="Use pelo menos 8 caracteres."
            />
            <div className="mt-1 mb-5 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-start gap-2 text-[11px]" htmlFor="termos">
                <input id="termos" name="termos" type="checkbox" required className={checkboxClass} />
                <span>Aceito os termos de uso e a política de privacidade.</span>
              </label>
            </div>
            <Button type="submit" block disabled={submitting}>
              Criar conta <ArrowRight />
            </Button>
            <p
              role={signupMessage ? 'alert' : undefined}
              aria-live="polite"
              className="mt-[14px] text-xs text-muted-foreground"
            >
              {signupMessage || 'Ao criar a conta, você entrará automaticamente.'}
            </p>
          </form>
        </Surface>
      </div>

      <Surface
        as="aside"
        padded={false}
        className="mt-6 flex items-center justify-between gap-6 px-[26px] py-5 max-sm:flex-col max-sm:items-start max-sm:gap-[14px] max-sm:p-[22px]"
      >
        <p className="text-[12px]">
          Não precisa de conta para descobrir eventos no mapa.
          <br />
          <strong>Crie uma conta para consultar e editar seu perfil.</strong>
        </p>
        <Button asChild variant="link">
          <Link to={paths.home}>
            Voltar para explorar <ArrowRight />
          </Link>
        </Button>
      </Surface>
    </>
  )
}
