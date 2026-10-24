import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const sizes = {
  xs: 'text-[10px]',
  base: 'text-[11px]',
  sm: 'text-[12px]',
  md: 'text-[13px]',
} as const

interface DemoNoteProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  size?: keyof typeof sizes
}

/** Aviso discreto de que o conteúdo é demonstrativo. */
export default function DemoNote({ as: Tag = 'p', size = 'base', className, ...rest }: DemoNoteProps) {
  return (
    <Tag
      className={cn(
        'leading-[1.65] text-muted [&_a]:text-maroon [&_a]:underline',
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}
