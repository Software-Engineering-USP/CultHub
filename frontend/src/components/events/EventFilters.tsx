import { LocateFixed, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDeviceLocation } from '@/hooks/useDeviceLocation'
import { todayIso } from '@/lib/agenda'
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

const radiusOptions = [1, 5, 10, 25, 50]

interface EventFiltersProps {
  onClose: () => void
}

export default function EventFilters({ onClose }: Readonly<EventFiltersProps>) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const myLocation = useDeviceLocation()
  const initialLat = Number(searchParams.get('lat'))
  const initialLng = Number(searchParams.get('lng'))
  const hasInitialLocation =
    searchParams.has('lat') &&
    searchParams.has('lng') &&
    Number.isFinite(initialLat) &&
    Number.isFinite(initialLng) &&
    Math.abs(initialLat) <= 90 &&
    Math.abs(initialLng) <= 180
  const [nearby, setNearby] = useState<{ lat: number; lng: number } | null>(() =>
    hasInitialLocation ? { lat: initialLat, lng: initialLng } : null,
  )
  const [radius, setRadius] = useState(() => {
    const value = Number(searchParams.get('raio'))
    return radiusOptions.includes(value) ? value : 10
  })
  const fromUrl = searchParams.get('categorias')?.split(',')
  const [selected, setSelected] = useState<CategoryId[]>(() =>
    fromUrl?.length ? categoryOrder.filter((category) => fromUrl.includes(category)) : [...categoryOrder],
  )
  const initialPrice = searchParams.get('preco')
  let initialPriceMode: PriceMode = 'all'
  if (initialPrice === 'gratuito') initialPriceMode = 'free'
  else if (initialPrice === 'pago') initialPriceMode = 'paid'
  const [price, setPrice] = useState<PriceMode>(initialPriceMode)
  const [from, setFrom] = useState(searchParams.get('de') ?? '')
  const [to, setTo] = useState(searchParams.get('ate') ?? '')
  const today = todayIso()
  // Digitando a data, dá para passar por cima do min/max do campo. Datas passadas sempre dariam lista
  // vazia, porque o catálogo já esconde os eventos encerrados.
  let periodError: { field: 'de' | 'ate'; message: string } | null = null
  if (from && from < today) periodError = { field: 'de', message: 'Escolha uma data a partir de hoje.' }
  else if (to && to < today) periodError = { field: 'ate', message: 'Escolha uma data a partir de hoje.' }
  else if (from && to && from > to)
    periodError = { field: 'ate', message: 'A data final não pode ser anterior à inicial.' }
  const invalidPeriod = periodError !== null
  const errorProps = (field: 'de' | 'ate') =>
    periodError?.field === field ? { 'aria-invalid': true, 'aria-describedby': 'filtro-periodo-erro' } : {}

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
    const allCategoriesSelected = categoryOrder.every((category) => selected.includes(category))
    if (allCategoriesSelected) params.delete('categorias')
    else params.set('categorias', selected.join(','))
    if (price === 'all') params.delete('preco')
    else params.set('preco', price === 'free' ? 'gratuito' : 'pago')
    for (const [key, value] of [
      ['de', from],
      ['ate', to],
    ]) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (nearby) {
      params.set('lat', String(nearby.lat))
      params.set('lng', String(nearby.lng))
      params.set('raio', String(radius))
    } else {
      params.delete('lat')
      params.delete('lng')
      params.delete('raio')
    }
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
        <legend className="mb-2 text-xs font-bold">Localização</legend>
        <Button
          type="button"
          variant={nearby ? 'default' : 'outline'}
          size="sm"
          disabled={myLocation.status === 'locating'}
          onClick={() => {
            if (nearby) {
              setNearby(null)
            } else if (myLocation.position) {
              setNearby({ lat: myLocation.position.latitude, lng: myLocation.position.longitude })
            } else {
              myLocation.request((position) => setNearby({ lat: position.latitude, lng: position.longitude }))
            }
          }}
          aria-pressed={nearby !== null}
        >
          <LocateFixed />
          {myLocation.status === 'locating'
            ? 'Obtendo localização…'
            : nearby
              ? 'Perto de mim: ativo'
              : 'Usar minha localização'}
        </Button>
        {nearby ? (
          <div className="mt-3 grid gap-1">
            <Label htmlFor="filtro-raio" className="text-xs font-normal">
              Raio da busca
            </Label>
            <select
              id="filtro-raio"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="min-h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {radiusOptions.map((value) => (
                <option key={value} value={value}>
                  {value} km
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="mt-1 text-2xs text-muted-foreground">
            {myLocation.status === 'denied'
              ? 'A localização foi bloqueada. Libere a permissão no navegador e tente novamente.'
              : myLocation.status === 'unavailable'
                ? 'Não foi possível obter sua localização. Você ainda pode usar os outros filtros.'
                : 'Mostra eventos próximos à sua localização.'}
          </p>
        )}
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

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-bold">Período</legend>
        <p className="-mt-1 mb-2 text-2xs text-muted-foreground">Só eventos de hoje em diante.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="filtro-de" className="text-xs font-normal">
              De
            </Label>
            <Input
              id="filtro-de"
              type="date"
              value={from}
              min={today}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              {...errorProps('de')}
              className="min-h-9 py-2"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filtro-ate" className="text-xs font-normal">
              Até
            </Label>
            <Input
              id="filtro-ate"
              type="date"
              value={to}
              min={from || today}
              onChange={(event) => setTo(event.target.value)}
              {...errorProps('ate')}
              className="min-h-9 py-2"
            />
          </div>
        </div>
        {periodError && (
          <p id="filtro-periodo-erro" role="alert" className="mt-1.5 text-xs text-destructive">
            {periodError.message}
          </p>
        )}
      </fieldset>

      <div className="mt-5 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelected([...categoryOrder])
            setPrice('all')
            setFrom('')
            setTo('')
            setNearby(null)
            setRadius(10)
          }}
          className="border-maroon/30 text-maroon"
        >
          Limpar
        </Button>
        <Button size="sm" onClick={apply} disabled={invalidPeriod} className="flex-1">
          Aplicar filtros
        </Button>
      </div>
    </div>
  )
}
