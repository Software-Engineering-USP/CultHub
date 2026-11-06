import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const sizes = {
  xs: 'text-2xs',
  sm: 'text-xs',
  md: 'text-sm',
} as const

interface DemoNoteProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** xs = 10px, sm = 12px (padrão), md = 14px */
  size?: keyof typeof sizes
}

/** Aviso discreto de que o conteúdo é demonstrativo. */
export default function DemoNote({
  as: Tag = 'p',
  size = 'sm',
  className,
  ...rest
}: Readonly<DemoNoteProps>) {
  return (
    <Tag
      className={cn('text-muted-foreground [&_a]:text-maroon [&_a]:underline', sizes[size], className)}
      {...rest}
    />
  )
}
