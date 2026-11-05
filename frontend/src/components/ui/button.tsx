import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add button), com os estilos do CultHub.
// O foco usa o contorno global definido em index.css.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 text-center font-bold transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'border border-transparent bg-primary text-primary-foreground hover:bg-primary/85',
        outline: 'border border-border bg-card text-foreground hover:bg-accent',
        /** Link de texto em bordô */
        link: 'font-semibold text-maroon underline underline-offset-4',
        /** Ação discreta, como "Responder" ou "Esqueci minha senha" */
        linkMuted: 'font-normal text-muted-foreground underline underline-offset-3',
      },
      size: {
        default: 'min-h-11 rounded-xl px-5 py-3 text-sm',
        sm: 'min-h-9 rounded-lg px-4 py-2 text-xs',
        icon: 'size-9 rounded-full',
      },
      block: {
        true: 'w-full',
      },
    },
    // Links não têm altura mínima nem padding de botão; o linkMuted também usa texto menor
    compoundVariants: [
      { variant: 'link', className: 'min-h-0 rounded-none p-0' },
      { variant: 'linkMuted', className: 'min-h-0 rounded-none px-0 py-1 text-xs' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Aplica o estilo no filho em vez de criar um <button>*/
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  type,
  ...props
}: Readonly<ButtonProps>) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}
