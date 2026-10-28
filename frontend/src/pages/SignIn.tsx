import BackLink from '../components/ui/BackLink'
import { Button } from '../components/ui/Button'
import CategoryDot from '../components/ui/CategoryDot'
import DemoNote from '../components/ui/DemoNote'
import Eyebrow from '../components/ui/Eyebrow'
import Field from '../components/ui/Field'
import Surface from '../components/ui/Surface'
import TextButton from '../components/ui/TextButton'
import TextLink from '../components/ui/TextLink'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { checkboxClass } from '../lib/classes'
import { preventSubmit } from '../lib/forms'

const panelClass = 'p-7 max-lg:p-[22px]'

export default function SignIn() {
  useDocumentTitle('Entrar ou criar conta | CultHub')

  return (
    <>
      <BackLink to="/">← Continuar como visitante</BackLink>

      <div className="mt-3 mb-[30px] max-sm:mt-1">
        <h1 className="max-w-[850px] max-md:text-[32px] max-sm:text-[30px]">
          Seu próximo encontro com a cultura começa aqui.
        </h1>
        <p className="mt-3 text-muted max-sm:text-[13px]">
          Entre para salvar eventos, organizar suas preferências e participar dos comentários.
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
            <p className="text-[13px]">
              Música, teatro, arte e encontros. Guarde o que te inspira e encontre tudo de novo na sua conta.
            </p>

            <div aria-hidden="true" className="mt-[25px] flex gap-[9px]">
              <CategoryDot id="music" size="md" />
              <CategoryDot id="theater" size="md" />
              <CategoryDot id="art" size="md" />
              <CategoryDot id="sport" size="md" />
              <CategoryDot id="festival" size="md" />
            </div>

            <DemoNote size="md" className="mt-6">
              Um convite para explorar a cidade. Os recursos de conta são apenas visuais nesta versão.
            </DemoNote>
          </div>
        </aside>

        <Surface as="section" aria-labelledby="login-titulo" padded={false} className={panelClass}>
          <h2 id="login-titulo" className="text-[23px]">
            Bem-vindo de volta
          </h2>
          <p className="mt-[7px] mb-6 text-[12px]">Entre na sua conta CultHub.</p>

          <form
            aria-label="Entrar (demonstração)"
            aria-describedby="login-aviso"
            autoComplete="off"
            onSubmit={preventSubmit}
          >
            <Field
              id="login-email"
              label="E-mail"
              type="email"
              placeholder="voce@exemplo.com"
              inputMode="email"
              autoComplete="off"
            />
            <Field
              id="login-senha"
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              autoComplete="off"
            />

            <div className="mt-1 mb-5 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-start gap-2 text-[11px]" htmlFor="lembrar">
                <input id="lembrar" type="checkbox" className={checkboxClass} />
                Lembrar de mim
              </label>
              <TextButton disabled aria-describedby="login-aviso">
                Esqueci minha senha
              </TextButton>
            </div>

            <Button type="submit" block disabled>
              Entrar <span aria-hidden="true">→</span>
            </Button>

            <DemoNote id="login-aviso" className="mt-[14px]">
              Formulário de demonstração, sem envio ou autenticação. Não use credenciais reais. Recuperação de
              senha indisponível.
            </DemoNote>
          </form>

          <TextLink to="/conta" className="mt-[22px] inline-block">
            Ver perfil de exemplo →
          </TextLink>
          <DemoNote size="sm" className="mt-[14px] mb-6">
            Conheça a conta fictícia de Lívia Costa, sem precisar fazer login.
          </DemoNote>
        </Surface>

        <Surface as="section" aria-labelledby="cadastro-titulo" padded={false} className={panelClass}>
          <h2 id="cadastro-titulo" className="text-[23px]">
            Primeira vez por aqui?
          </h2>
          <p className="mt-[7px] mb-6 text-[12px]">Crie sua conta e monte seu radar cultural.</p>

          <form
            aria-label="Criar conta (demonstração)"
            aria-describedby="cadastro-aviso"
            autoComplete="off"
            onSubmit={preventSubmit}
          >
            <Field
              id="cadastro-nome"
              label="Nome"
              type="text"
              placeholder="Como você quer ser chamado?"
              autoComplete="off"
            />
            <Field
              id="cadastro-email"
              label="E-mail"
              type="email"
              placeholder="voce@exemplo.com"
              inputMode="email"
              autoComplete="off"
            />
            <Field
              id="cadastro-senha"
              label="Senha"
              type="password"
              placeholder="Crie uma senha"
              minLength={8}
              autoComplete="off"
              help="Use pelo menos 8 caracteres. Apenas um exemplo, não insira uma senha real."
            />

            <div className="mt-1 mb-5 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-start gap-2 text-[11px]" htmlFor="termos">
                <input id="termos" type="checkbox" className={checkboxClass} />
                <span>
                  Aceito os termos e a política de privacidade <strong>ilustrativos</strong>. Esta opção não
                  registra consentimento nem cria uma conta.
                </span>
              </label>
            </div>

            <Button type="submit" block disabled>
              Criar conta <span aria-hidden="true">→</span>
            </Button>

            <DemoNote id="cadastro-aviso" className="mt-[14px]">
              Formulário visual de demonstração. Nenhum cadastro é realizado e nenhum dado é enviado. Não há
              termos contratuais ativos nesta versão.
            </DemoNote>
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
          <strong>Entre apenas quando quiser salvar ou comentar.</strong> Nesta demonstração, esses recursos
          estão desativados.
        </p>
        <TextLink to="/">Voltar para explorar →</TextLink>
      </Surface>
    </>
  )
}
