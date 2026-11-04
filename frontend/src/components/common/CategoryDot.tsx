import { categories } from '@/lib/categories'
import { cn } from '@/lib/utils'
import type { CategoryId } from '@/types'

interface CategoryDotProps {
  id: CategoryId
  size?: 'sm' | 'md'
}

export default function CategoryDot({ id, size = 'sm' }: Readonly<CategoryDotProps>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 rounded-full',
        size === 'sm' ? 'size-2' : 'size-3',
        categories[id].dot,
      )}
    />
  )
}
