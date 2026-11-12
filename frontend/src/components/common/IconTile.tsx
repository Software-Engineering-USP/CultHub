import type { LucideIcon } from 'lucide-react'

/** Ícone dentro de um quadrado arredondado bege. */
export default function IconTile({ icon: Icon }: Readonly<{ icon: LucideIcon }>) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand-300 text-maroon"
    >
      <Icon className="size-6" />
    </span>
  )
}
