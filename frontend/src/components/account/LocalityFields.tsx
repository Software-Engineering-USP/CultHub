import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Field from '@/components/common/Field'
import { Label } from '@/components/ui/label'
import { useCities, useStates } from '@/hooks/useLocalities'
import { findCity, matchCities } from '@/lib/locality'
import { cn } from '@/lib/utils'

const MAX_SUGGESTIONS = 8

interface LocalityFieldsProps {
  defaultCity: string
  defaultState: string
}

/**
 * Estado (`name="estado"`, sigla) e cidade (`name="cidade"`) do perfil. A cidade é buscada
 * entre os municípios do IBGE da UF escolhida; fora da lista, o campo fica inválido e o
 * formulário não envia.
 */
export default function LocalityFields({ defaultCity, defaultState }: Readonly<LocalityFieldsProps>) {
  const [state, setState] = useState(defaultState)
  const [city, setCity] = useState(defaultCity)
  const { states, error: statesError } = useStates()
  const { cities, error: citiesError, loading } = useCities(state)

  const unknownCity = Boolean(state && city.trim() && cities.length && !findCity(cities, city))

  let help = ''
  if (!state) {
    help = city
      ? `Escolha o estado de ${city} para confirmar a cidade.`
      : 'Escolha o estado para buscar a cidade.'
  } else if (loading) help = 'Carregando as cidades…'
  else if (citiesError) help = citiesError

  return (
    <>
      <div className="mb-4.5 grid min-w-0 content-start gap-2">
        <Label htmlFor="estado">Estado</Label>
        <div className="relative">
          <select
            id="estado"
            name="estado"
            value={state}
            autoComplete="address-level1"
            aria-describedby={statesError ? 'estado-ajuda' : undefined}
            onChange={(event) => {
              // Trocar de UF invalida a cidade; sem UF antes (perfil antigo), a cidade é conferida na nova.
              if (state) setCity('')
              setState(event.target.value)
            }}
            className="min-h-11 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-input bg-card py-3 pr-10 pl-3.5 text-xs text-foreground"
          >
            <option value="">Não informado</option>
            {/* Enquanto a lista não chega, a UF atual continua escolhida. */}
            {!states.length && state && <option value={state}>{state}</option>}
            {states.map((item) => (
              <option key={item.sigla} value={item.sigla}>
                {item.nome} ({item.sigla})
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {statesError && (
          <small id="estado-ajuda" className="text-2xs text-muted-foreground">
            {statesError}
          </small>
        )}
      </div>

      <CitySearch
        value={city}
        onValueChange={setCity}
        cities={cities}
        readOnly={!state}
        help={help}
        error={unknownCity ? `Não há um município com esse nome em ${state}. Escolha um da lista.` : ''}
      />
    </>
  )
}

interface CitySearchProps {
  value: string
  onValueChange: (value: string) => void
  cities: string[]
  readOnly: boolean
  help: string
  /** Cidade fora da lista: impede o envio do formulário. */
  error: string
}

/** Campo de cidade com sugestões da lista de municípios enquanto a pessoa digita. */
function CitySearch({ value, onValueChange, cities, readOnly, help, error }: Readonly<CitySearchProps>) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const official = findCity(cities, value)
  const suggestions = open && !readOnly && official !== value ? matchCities(cities, value, MAX_SUGGESTIONS) : []
  const expanded = suggestions.length > 0

  // Enquanto a pessoa digita, o erro não aparece (só no envio ou ao sair do campo).
  const shownError = open ? '' : error

  useEffect(() => {
    inputRef.current?.setCustomValidity(error)
  }, [error])

  function choose(city: string) {
    onValueChange(city)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
      return
    }
    if (!expanded) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const total = suggestions.length
      setActive((current) => {
        if (current < 0) return step > 0 ? 0 : total - 1
        return (current + step + total) % total
      })
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(suggestions[active])
    }
  }

  return (
    <div className="relative">
      <Field
        ref={inputRef}
        id="cidade"
        name="cidade"
        label="Cidade"
        type="text"
        role="combobox"
        autoComplete="off"
        maxLength={100}
        readOnly={readOnly}
        help={shownError || help || undefined}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={Boolean(shownError) || undefined}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false)
          // "sao paulo" vira "São Paulo", como o backend gravaria.
          if (official && official !== value) onValueChange(official)
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Cidades do estado"
        hidden={!expanded}
        className="absolute inset-x-0 top-[72px] z-10 overflow-hidden rounded-xl border border-border bg-card shadow-popover"
      >
        {suggestions.map((city, index) => (
          <li
            key={city}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // mousedown em vez de click: o clique tiraria o foco do campo e fecharia a lista antes.
            onMouseDown={(event) => {
              event.preventDefault()
              choose(city)
            }}
            onMouseEnter={() => setActive(index)}
            className={cn(
              'cursor-pointer border-b border-border px-3.5 py-2.5 text-xs last:border-b-0',
              index === active && 'bg-primary/30 text-maroon',
            )}
          >
            {city}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {expanded ? `${suggestions.length} sugestões. Use as setas para escolher.` : ''}
      </p>
    </div>
  )
}
