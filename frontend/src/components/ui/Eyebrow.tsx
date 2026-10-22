import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface EyebrowProps {
  tight?: boolean
  className?: string
  children: ReactNode
}

/** Texto pequeno em caixa-alta. O tamanho e a cor vêm de className. */
export default function Eyebrow({ tight, className, children }: EyebrowProps) {
  return (
    <span className={cn('font-[750] uppercase', tight ? 'tracking-[.08em]' : 'tracking-[.12em]', className)}>
      {children}
    </span>
  )
}
