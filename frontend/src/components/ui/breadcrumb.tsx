import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add breadcrumb), com o visual do CultHub:
// texto pequeno e discreto, links sem sublinhado e "/" como separador.

export function Breadcrumb({ ...props }: Readonly<ComponentProps<'nav'>>) {
  return <nav aria-label="Caminho da página" data-slot="breadcrumb" {...props} />
}

export function BreadcrumbList({ className, ...props }: Readonly<ComponentProps<'ol'>>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn('flex flex-wrap items-center gap-2 text-xs break-words text-muted-foreground', className)}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }: Readonly<ComponentProps<'li'>>) {
  return <li data-slot="breadcrumb-item" className={cn('inline-flex items-center', className)} {...props} />
}

export function BreadcrumbLink({
  asChild,
  className,
  ...props
}: Readonly<
  ComponentProps<'a'> & {
    /** Aplica o estilo no filho (por exemplo, o <Link> do React Router) */
    asChild?: boolean
  }
>) {
  const Comp = asChild ? Slot.Root : 'a'

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn('no-underline transition-colors hover:text-foreground', className)}
      {...props}
    />
  )
}

export function BreadcrumbPage({ className, ...props }: Readonly<ComponentProps<'span'>>) {
  return <span data-slot="breadcrumb-page" aria-current="page" className={className} {...props} />
}

export function BreadcrumbSeparator({ children, className, ...props }: Readonly<ComponentProps<'li'>>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('text-muted-foreground/70 [&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? '/'}
    </li>
  )
}
