import type { LucideIcon } from 'lucide-react'

/** Ícone dentro de um quadrado arredondado bege. */
export default function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f3e5d1] text-maroon"
    >
      <Icon className="size-6" />
    </span>
  )
}
