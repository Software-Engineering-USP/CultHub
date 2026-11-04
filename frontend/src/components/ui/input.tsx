import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add input), com o estilo de campo do CultHub.
export function Input({ className, type, ...props }: Readonly<ComponentProps<'input'>>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'min-h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-3 text-xs text-foreground read-only:bg-muted read-only:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
