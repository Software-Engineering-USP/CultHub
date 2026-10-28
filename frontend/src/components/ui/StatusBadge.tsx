import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface StatusBadgeProps {
  tone?: 'default' | 'green'
  size?: 'md' | 'sm'
  className?: string
  children: ReactNode
}

export default function StatusBadge({
  tone = 'default',
  size = 'md',
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] rounded-[20px] border px-[13px] py-2 font-semibold',
        size === 'md' ? 'text-[11px]' : 'text-[10px]',
        tone === 'green' ? 'border-[#dce5d5] bg-[#e9f0e4] text-[#365b3f]' : 'border-line bg-[#eee7db]',
        className,
      )}
    >
      {children}
    </span>
  )
}
