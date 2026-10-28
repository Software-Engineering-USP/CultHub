import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CategoryBadgeProps {
  size?: 'md' | 'lg'
  className?: string
  children: ReactNode
}

export default function CategoryBadge({ size = 'md', className, children }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[20px] bg-surface text-[10px] font-bold tracking-[.015em] text-maroon',
        size === 'md' ? 'px-[11px] py-[5px]' : 'px-[15px] py-2',
        className,
      )}
    >
      {children}
    </span>
  )
}
