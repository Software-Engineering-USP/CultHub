import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add toggle-group), no formato "abas" do CultHub.
export function ToggleGroup({
  className,
  ...props
}: Readonly<ComponentProps<typeof ToggleGroupPrimitive.Root>>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('flex w-full gap-1 rounded-xl bg-muted p-1', className)}
      {...props}
    />
  )
}

export function ToggleGroupItem({
  className,
  ...props
}: Readonly<ComponentProps<typeof ToggleGroupPrimitive.Item>>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'min-h-10 flex-1 rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-card/60 data-[state=on]:bg-primary data-[state=on]:font-bold data-[state=on]:text-primary-foreground',
        className,
      )}
      {...props}
    />
  )
}
