import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  id?: string
  title: string
  description?: ReactNode
  as?: 'h1' | 'h2'
  /** Classes extras; a margem padrão (mb-6) pode ser trocada aqui */
  className?: string
  titleClassName?: string
  /** @deprecated Use `className="mb-7"`. Sai quando a Minha conta migrar. */
  variant?: 'section' | 'page'
  /** @deprecated Use `className`. Sai quando a Minha conta migrar. */
  marginClass?: string
  /** Conteúdo alinhado à direita (botão, selo, etc.) */
  children?: ReactNode
}

export default function SectionHeading({
  id,
  title,
  description,
  as: Heading = 'h2',
  className,
  titleClassName,
  variant,
  marginClass,
  children,
}: Readonly<SectionHeadingProps>) {
  return (
    <div
      className={cn(
        'mb-6 flex items-center justify-between gap-6 max-sm:mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-4',
        variant === 'page' && 'mb-7',
        marginClass,
        className,
      )}
    >
      <div>
        <Heading id={id} className={titleClassName}>
          {title}
        </Heading>
        {description && <p className="mt-2 text-muted-foreground max-sm:text-xs">{description}</p>}
      </div>
      {children}
    </div>
  )
}
