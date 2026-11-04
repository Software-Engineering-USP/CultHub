import { Slider as SliderPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// Base: shadcn/ui (npx shadcn add slider). Uma bolinha por valor em `value`;
export function Slider({
  className,
  value,
  thumbLabels = [],
  ...props
}: ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
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
      {value?.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels[index]}
          className="block size-5 rounded-full border-2 border-primary bg-card shadow-badge"
        />
      ))}
    </SliderPrimitive.Root>
  )
}
