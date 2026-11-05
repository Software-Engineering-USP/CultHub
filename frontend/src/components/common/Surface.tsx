import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** @deprecated Não tem mais efeito (o padding vem de className). Sai quando Entrar e Minha conta migrarem. */
  padded?: boolean
}

/** Painel claro com borda, raio e sombra suave. Fundo e padding podem ser trocados por className. */
export default function Surface({ as: Tag = 'div', padded, className, ...rest }: Readonly<SurfaceProps>) {
  void padded
  return (
    <Tag
      className={cn(
        'rounded-3xl border border-border bg-card p-7 shadow-soft max-sm:rounded-2xl max-sm:p-5.5',
        className,
      )}
      {...rest}
    />
  )
}
