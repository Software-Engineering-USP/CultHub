import { X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { categories, categoryOrder } from '@/lib/categories'
import { paths } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CategoryId } from '@/types'

type PriceMode = 'all' | 'free' | 'paid'

const priceModes: { value: PriceMode; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'free', label: 'Gratuito' },
  { value: 'paid', label: 'Pago' },
]

interface EventFiltersProps {
  onClose: () => void
}

export default function EventFilters({ onClose }: Readonly<EventFiltersProps>) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromUrl = searchParams.get('categorias')?.split(',')
  const [selected, setSelected] = useState<CategoryId[]>(() =>
    fromUrl?.length ? categoryOrder.filter((category) => fromUrl.includes(category)) : [...categoryOrder],
  )
  const initialPrice = searchParams.get('preco')
  let initialPriceMode: PriceMode = 'all'
  if (initialPrice === 'gratuito') initialPriceMode = 'free'
  else if (initialPrice === 'pago') initialPriceMode = 'paid'
  const [price, setPrice] = useState<PriceMode>(initialPriceMode)

  function toggleCategory(id: CategoryId, checked: boolean) {
    setSelected((current) => {
      if (!checked && current.length === 1) return current
      return checked
        ? categoryOrder.filter((category) => category === id || current.includes(category))
        : current.filter((category) => category !== id)
    })
  }

  function apply() {
    const params = new URLSearchParams(searchParams)
    if (selected.length === categoryOrder.length) params.delete('categorias')
    else params.set('categorias', selected.join(','))
    if (price === 'all') params.delete('preco')
    else params.set('preco', price === 'free' ? 'gratuito' : 'pago')
    navigate({ pathname: paths.home, search: params.toString() })
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
      <p className="mt-1 text-xs text-muted-foreground">Os filtros serão aplicados ao catálogo de eventos.</p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-bold">Categorias</legend>
        <div className="grid gap-2">
          {categoryOrder.map((id) => (
            <div key={id} className="flex items-center gap-2.5">
              <Checkbox
                id={`filtro-${id}`}
                checked={selected.includes(id)}
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
          value={price}
          onValueChange={(value: PriceMode | '') => value && setPrice(value)}
          aria-label="Preço"
        >
          {priceModes.map((mode) => (
            <ToggleGroupItem key={mode.value} value={mode.value} className="min-h-8 text-xs">
              {mode.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <div className="mt-5 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelected([...categoryOrder])
            setPrice('all')
          }}
          className="border-maroon/30 text-maroon"
        >
          Limpar
        </Button>
        <Button size="sm" onClick={apply} className="flex-1">
          Aplicar filtros
        </Button>
      </div>
    </div>
  )
}
