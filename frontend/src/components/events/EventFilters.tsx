import { X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useEvents } from '@/hooks/useEvents'
import { categories, categoryOrder } from '@/lib/categories'
import { maxPrice } from '@/lib/events'
import { defaultFilters, matchesFilters } from '@/lib/filters'
import type { PriceMode } from '@/lib/filters'
import { cn } from '@/lib/utils'
import { api } from '@/services/api'
import type { CategoryId } from '@/types'

const priceModes: { value: PriceMode; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratuito' },
  { value: 'paid', label: 'Pago' },
]

interface EventFiltersProps {
  /** Chamado ao fechar no X e depois de aplicar */
  onClose: () => void
}

/** Painel "Filtrar Eventos" (abre pelo botão Filtros do Header). */
export default function EventFilters({ onClose }: Readonly<EventFiltersProps>) {
  const events = useEvents()
  const ceiling = maxPrice(events)
  const [filters, setFilters] = useState(() => defaultFilters(ceiling))
  const matching = events.filter((event) => matchesFilters(event, filters)).length

  function toggleCategory(id: CategoryId, checked: boolean) {
    setFilters((current) => ({
      ...current,
      categories: checked
        ? categoryOrder.filter((cat) => cat === id || current.categories.includes(cat))
        : current.categories.filter((cat) => cat !== id),
    }))
  }

  // Os campos e o slider mudam a mesma faixa; o mínimo nunca passa do máximo e vice-versa.
  function setMinPrice(value: number) {
    setFilters((current) => ({ ...current, minPrice: clamp(value, 0, current.maxPrice) }))
  }

  function setMaxPrice(value: number) {
    setFilters((current) => ({ ...current, maxPrice: clamp(value, current.minPrice, ceiling) }))
  }

  function apply() {
    void api.events.filter(filters)
    onClose()
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl">Filtrar Eventos</h2>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" className="text-maroon">
          <X className="size-5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Encontre a experiência que combina com você.</p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-bold">Categorias</legend>
        <div className="grid gap-2">
          {categoryOrder.map((id) => (
            <div key={id} className="flex items-center gap-2.5">
              <Checkbox
                id={`filtro-${id}`}
                checked={filters.categories.includes(id)}
                onCheckedChange={(checked) => toggleCategory(id, checked === true)}
                className={cn('size-4 [&_svg]:size-3', categories[id].checkbox)}
              />
              <Label htmlFor={`filtro-${id}`} className="text-sm font-normal">
                {categories[id].label}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-bold">Preço</legend>
        <ToggleGroup
          type="single"
          value={filters.price}
          onValueChange={(value: PriceMode | '') =>
            value && setFilters((current) => ({ ...current, price: value }))
          }
          aria-label="Preço"
        >
          {priceModes.map((mode) => (
            <ToggleGroupItem key={mode.value} value={mode.value} className="min-h-8 text-xs">
              {mode.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {filters.price !== 'free' && (
          <div className="mt-4">
            <Slider
              min={0}
              max={ceiling}
              step={5}
              value={[filters.minPrice, filters.maxPrice]}
              onValueChange={([min, max]) =>
                setFilters((current) => ({ ...current, minPrice: min, maxPrice: max }))
              }
              thumbLabels={['Preço mínimo', 'Preço máximo']}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <PriceInput id="preco-min" label="Mínimo" value={filters.minPrice} onChange={setMinPrice} />
              <PriceInput id="preco-max" label="Máximo" value={filters.maxPrice} onChange={setMaxPrice} />
            </div>
          </div>
        )}
      </fieldset>

      <div className="mt-5 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilters(defaultFilters(ceiling))}
          className="border-maroon/30 text-maroon"
        >
          Limpar
        </Button>
        <Button size="sm" onClick={apply} className="flex-1">
          Aplicar filtros
        </Button>
      </div>
      <p aria-live="polite" className="mt-3 text-center text-xs text-muted-foreground">
        {matching === 1 ? '1 evento corresponde' : `${matching} eventos correspondem`} aos filtros
      </p>
    </div>
  )
}

function PriceInput({
  id,
  label,
  value,
  onChange,
}: Readonly<{
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}>) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground"
        >
          R$
        </span>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="min-h-9 py-1.5 pl-9"
        />
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
