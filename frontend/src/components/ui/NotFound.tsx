import { ButtonLink } from './Button'
import Surface from './Surface'

export default function NotFound({ message }: { message?: string }) {
  return (
    <Surface as="section" aria-labelledby="nao-encontrado" className="mx-auto max-w-[560px] text-center">
      <h1 id="nao-encontrado" className="text-[30px]">
        Página não encontrada
      </h1>
      <p className="mt-3 text-muted">
        {message ?? 'O endereço acessado não existe nesta demonstração.'}
      </p>
      <ButtonLink to="/" className="mt-6">
        Voltar para explorar
      </ButtonLink>
    </Surface>
  )
}
