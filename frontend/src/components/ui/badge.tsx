import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add badge), com as variantes do CultHub.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-transparent',
  {
    variants: {
      variant: {
        /** Selo claro com texto bordô (categoria do evento) */
        surface: 'bg-card font-bold tracking-wide text-maroon',
        /** Selo de status neutro */
        muted: 'border-border bg-muted font-semibold',
        success: 'border-success-border bg-success font-semibold text-success-foreground',
      },
      size: {
        sm: 'px-3 py-1 text-2xs',
        md: 'px-3 py-2 text-xs',
        lg: 'px-4 py-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'surface',
      size: 'sm',
    },
  },
)

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, size, ...props }: Readonly<BadgeProps>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
