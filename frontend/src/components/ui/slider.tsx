import { Slider as SliderPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add slider). Uma bolinha por valor em `value`;
export function Slider({
  className,
  value,
  thumbLabels = [],
  ...props
}: Readonly<ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }>) {
  // Cada bolinha é identificada pela posição em `value` (a 1ª é sempre o mínimo, a 2ª o máximo...):
  // a quantidade não muda e elas nunca trocam de lugar, então a posição é uma chave estável.
  const thumbs = (value ?? []).map((_, position) => ({
    key: `thumb-${position}`,
    label: thumbLabels[position],
  }))

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      className={cn('relative flex w-full touch-none items-center py-2 select-none', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {thumbs.map((thumb) => (
        <SliderPrimitive.Thumb
          key={thumb.key}
          aria-label={thumb.label}
          className="block size-5 rounded-full border-2 border-primary bg-card shadow-badge"
        />
      ))}
    </SliderPrimitive.Root>
  )
}
