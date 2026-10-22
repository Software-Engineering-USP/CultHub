import { categories } from '../../lib/categories'
import type { CategoryId } from '../../lib/categories'
import { cn } from '../../lib/cn'

interface CategoryDotProps {
  id: CategoryId
  size?: 'sm' | 'md'
}

export default function CategoryDot({ id, size = 'sm' }: CategoryDotProps) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 rounded-full',
        size === 'sm' ? 'mr-[7px] h-2 w-2' : 'h-3 w-3',
        categories[id].dot,
      )}
    />
  )
}
