import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EyebrowProps {
  className?: string
  children: ReactNode
}

/** Texto pequeno em caixa-alta. O tamanho e a cor vêm de className. */
export default function Eyebrow({ className, children }: Readonly<EyebrowProps>) {
  return <span className={cn('font-bold tracking-widest uppercase', className)}>{children}</span>
}
