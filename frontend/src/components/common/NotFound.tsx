import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/paths'
import Surface from './Surface'

export default function NotFound({ message }: Readonly<{ message?: string }>) {
  return (
    <Surface as="section" aria-labelledby="nao-encontrado" className="mx-auto max-w-[560px] text-center">
      <h1 id="nao-encontrado" className="text-[30px]">
        Página não encontrada
      </h1>
      <p className="mt-3 text-muted-foreground">
        {message ?? 'O endereço acessado não existe nesta demonstração.'}
      </p>
      <Button asChild className="mt-6">
        <Link to={paths.home}>Voltar para explorar</Link>
      </Button>
    </Surface>
  )
}
