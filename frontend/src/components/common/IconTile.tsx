import type { ReactNode } from 'react'

export default function IconTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f3e5d1] text-maroon"
    >
      {children}
    </span>
  )
}
