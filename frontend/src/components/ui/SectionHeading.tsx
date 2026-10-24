import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface SectionHeadingProps {
  id?: string
  title: string
  description?: ReactNode
  as?: 'h1' | 'h2'
  /** "page" tem margem inferior um pouco maior (28px em vez de 24px) */
  variant?: 'section' | 'page'
  marginClass?: string
  titleClassName?: string
  /** Conteúdo alinhado à direita (botão, selo, etc.) */
  children?: ReactNode
}

export default function SectionHeading({
  id,
  title,
  description,
  as: Heading = 'h2',
  variant = 'section',
  marginClass,
  titleClassName,
  children,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 max-sm:mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-4',
        marginClass ?? (variant === 'page' ? 'mb-7' : 'mb-6'),
      )}
    >
      <div>
        <Heading id={id} className={titleClassName}>
          {title}
        </Heading>
        {description && <p className="mt-2 text-muted max-sm:text-[12px]">{description}</p>}
      </div>
      {children}
    </div>
  )
}
