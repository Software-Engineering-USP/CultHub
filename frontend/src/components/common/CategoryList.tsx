import CategoryDot from '@/components/common/CategoryDot'
import { categories, categoryOrder } from '@/lib/categories'
import { cn } from '@/lib/utils'

interface CategoryListProps {
  className?: string
  'aria-label'?: string
}

/** Categorias com a bolinha de cor (legenda do mapa e popover de filtros). */
export default function CategoryList({ className, ...rest }: CategoryListProps) {
  return (
    <ul className={cn('flex flex-wrap gap-3', className)} {...rest}>
      {categoryOrder.map((id) => (
        <li key={id} className="inline-flex items-center gap-2">
          <CategoryDot id={id} />
          {categories[id].label}
        </li>
      ))}
    </ul>
  )
}
