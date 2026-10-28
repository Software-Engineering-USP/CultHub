import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** Classe de fundo (padrão: bg-surface) */
  bg?: string
  /** Aplica o padding padrão (28px, 22px no mobile) */
  padded?: boolean
}

/** Painel branco com borda, raio e sombra suave. */
export default function Surface({
  as: Tag = 'div',
  bg = 'bg-surface',
  padded = true,
  className,
  ...rest
}: SurfaceProps) {
  return (
    <Tag
      className={cn(
        'rounded-3xl border border-line shadow-soft max-sm:rounded-[20px]',
        bg,
        padded && 'p-7 max-sm:p-[22px]',
        className,
      )}
      {...rest}
    />
  )
}
