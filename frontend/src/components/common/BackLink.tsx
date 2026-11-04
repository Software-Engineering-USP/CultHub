import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-4 inline-flex items-center gap-[9px] text-[13px] font-semibold no-underline">
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  )
}
