import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export default function BackLink({ to, children }: Readonly<{ to: string; children: ReactNode }>) {
  return (
    <Link to={to} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold no-underline">
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  )
}
