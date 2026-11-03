import NotFound from '@/components/common/NotFound'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Página não encontrada | CultHub')
  return <NotFound />
}
