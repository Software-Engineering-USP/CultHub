import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { logDemoAction } from '@/lib/demo'

const options = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'date', label: 'Data' },
  { value: 'price-asc', label: 'Preço: do menor para o maior' },
  { value: 'price-desc', label: 'Preço: do maior para o menor' },
]

/** "Ordenar: ..." da lista de eventos. Por enquanto só registra a escolha no console. */
export default function EventSort() {
  return (
    <div className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
      <span id="ordenar-rotulo">Ordenar:</span>
      <Select defaultValue="relevance" onValueChange={(by) => logDemoAction('Ordenar eventos', { by })}>
        <SelectTrigger aria-labelledby="ordenar-rotulo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
