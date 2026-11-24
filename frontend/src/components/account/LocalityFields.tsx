import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Field from '@/components/common/Field'
import { Label } from '@/components/ui/label'
import { useCities, useStates } from '@/hooks/useLocalities'
import { findCity, matchCities, normalizePlaceName } from '@/lib/locality'
import { cn } from '@/lib/utils'

const MAX_SUGGESTIONS = 8

function sameName(a: string, b: string) {
  return normalizePlaceName(a) === normalizePlaceName(b)
}

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
  const { cities, error: citiesError, loading, retry } = useCities(state)

  // Perfil antigo com cidade e sem UF: o campo fica editável para a pessoa poder apagá-la.
  const legacyCity = !defaultState && defaultCity !== ''
  // Mesma localidade já gravada (a cidade pode estar com outra caixa ou sem acento).
  const unchanged = state === defaultState && sameName(city, defaultCity)
  const official = findCity(cities, city)
  // Nome que o campo assume ao sair dele ou com Enter: o oficial, ou o gravado se não mudou.
  const canonical = official ?? (unchanged && city.trim() ? defaultCity : undefined)

  let error = ''
  if (city.trim() && !unchanged) {
    if (!state) error = 'Escolha o estado da cidade.'
    else if (cities.length && !official) {
      error = `Não há um município com esse nome em ${state}. Escolha um da lista.`
    } else if (loading) error = `Espere carregar as cidades de ${state}.`
    else if (citiesError) error = 'Não foi possível conferir a cidade.'
  }

  let help = ''
  if (!state) {
    help =
      legacyCity && unchanged
        ? `Escolha o estado de ${defaultCity} para confirmar a cidade, ou apague o campo.`
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
              const next = event.target.value
              // Perfil antigo que volta para "Não informado" recupera a cidade gravada; fora isso,
              // trocar de UF invalida a cidade (sem UF antes, ela é conferida na nova).
              if (!next && legacyCity) setCity(defaultCity)
              else if (state) setCity('')
              setState(next)
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
        canonical={canonical}
        cities={cities}
        readOnly={!state && !legacyCity}
        help={help}
        error={error}
        onRetry={state && citiesError ? retry : undefined}
      />
    </>
  )
}

interface CitySearchProps {
  value: string
  onValueChange: (value: string) => void
  /** Nome a pôr no campo ao sair dele ou com Enter ("sao paulo" vira "São Paulo"). */
  canonical?: string
  cities: string[]
  readOnly: boolean
  help: string
  /** Cidade que não pode ser enviada: impede o envio do formulário. */
  error: string
  /** Mostra "Tentar de novo" (lista de cidades que não carregou). */
  onRetry?: () => void
}

/** Campo de cidade com sugestões da lista de municípios enquanto a pessoa digita. */
function CitySearch({
  value,
  onValueChange,
  canonical,
  cities,
  readOnly,
  help,
  error,
  onRetry,
}: Readonly<CitySearchProps>) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const candidates = readOnly ? [] : matchCities(cities, value, MAX_SUGGESTIONS)
  const suggestions = open ? candidates : []
  const expanded = suggestions.length > 0
  // Enquanto a pessoa digita, o erro não aparece (só no envio ou ao sair do campo).
  const shownError = open ? '' : error
  const message = shownError || help

  useEffect(() => {
    inputRef.current?.setCustomValidity(error)
  }, [error])

  function close() {
    setOpen(false)
    setActive(-1)
  }

  function choose(city: string) {
    onValueChange(city)
    close()
  }

  function settle() {
    if (canonical && canonical !== value) onValueChange(canonical)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const total = candidates.length
      if (!total) return
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      // Lista fechada (depois de Esc ou de uma escolha): a seta reabre no primeiro ou no último.
      if (!expanded) {
        setOpen(true)
        setActive(step > 0 ? 0 : total - 1)
        return
      }
      setActive((current) => {
        if (current < 0) return step > 0 ? 0 : total - 1
        return (current + step + total) % total
      })
    } else if (event.key === 'Enter') {
      if (expanded && active >= 0) {
        event.preventDefault()
        choose(suggestions[active])
        return
      }
      // Enter que envia o formulário: o campo fica com o nome oficial, como ao sair dele.
      close()
      settle()
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
        help={
          message || onRetry ? (
            <>
              {message}
              {onRetry && (
                <>
                  {' '}
                  <button type="button" onClick={onRetry} className="font-semibold text-maroon underline">
                    Tentar de novo
                  </button>
                </>
              )}
            </>
          ) : undefined
        }
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
          close()
          settle()
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
