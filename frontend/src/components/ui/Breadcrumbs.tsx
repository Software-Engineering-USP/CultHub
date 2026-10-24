import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export interface Crumb {
  label: string
  to?: string
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Caminho da página">
      <ol className="mb-6 flex flex-wrap items-center gap-[9px] text-[11px] text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li
              key={item.label}
              aria-current={isLast ? 'page' : undefined}
              className={cn(index > 0 && "before:mr-[9px] before:text-[#8c8a86] before:content-['/']")}
            >
              {item.to && !isLast ? (
                <Link to={item.to} className="no-underline">
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
