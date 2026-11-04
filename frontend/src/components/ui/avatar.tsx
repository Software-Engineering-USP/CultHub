import { Avatar as AvatarPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add avatar), com tamanhos e cores do CultHub.
// inline-flex (e não flex) para o avatar poder ser centralizado com text-center.
export function Avatar({
  className,
  size = 'md',
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root> & { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative inline-flex size-11 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-19 data-[size=sm]:size-9.5',
        className,
      )}
      {...props}
    />
  )
}

export function AvatarFallback({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-sand-300 font-bold text-maroon group-data-[size=lg]/avatar:text-2xl',
        className,
      )}
      {...props}
    />
  )
}
