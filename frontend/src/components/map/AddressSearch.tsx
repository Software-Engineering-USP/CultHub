import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Field from '@/components/common/Field'
import { useOrigemBusca } from '@/hooks/useOrigemBusca'
import { cn } from '@/lib/utils'
import { MINIMO_BUSCA } from '@/services/rotas'
import type { EnderecoSugerido } from '@/services/rotas'
import type { Coordinates } from '@/types'

interface AddressSearchProps {
  id: string
  label: string
  help?: ReactNode
  value: string
  onValueChange: (value: string) => void
  onSelect: (sugestao: EnderecoSugerido) => void
  /** Texto já confirmado (sugestão escolhida ou endereço do pino): não é buscado de novo */
  confirmed?: string | null
  /** Ponto para puxar as sugestões para perto (o local do evento) */
  near?: Coordinates
  invalid?: boolean
}

/** Campo de endereço com sugestões do OpenStreetMap enquanto a pessoa digita. */
export default function AddressSearch({
  id,
  label,
  help,
  value,
  onValueChange,
  onSelect,
  confirmed,
  near,
  invalid,
}: Readonly<AddressSearchProps>) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const searching = open && value.trim() !== (confirmed ?? '').trim()
  const { resultados, error, loading, pronto } = useOrigemBusca(value, { perto: near, ativo: searching })
  const expanded = searching && resultados.length > 0

  function choose(sugestao: EnderecoSugerido) {
    onSelect(sugestao)
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
      setActive((current) => (current + step + resultados.length) % resultados.length)
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(resultados[active])
    }
  }

  let status = ''
  if (searching && loading) status = 'Buscando endereços…'
  else if (searching && error) status = error
  else if (searching && pronto && resultados.length === 0)
    status = 'Nenhum endereço encontrado. Tente com cidade ou bairro.'
  else if (expanded) status = `${resultados.length} sugestões. Use as setas para escolher.`

  return (
    <div className="relative">
      <Field
        id={id}
        label={label}
        help={help}
        name={id}
        type="text"
        role="combobox"
        autoComplete="off"
        minLength={MINIMO_BUSCA}
        maxLength={200}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Sugestões de endereço"
        hidden={!expanded}
        className="-mt-3 mb-4.5 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      >
        {resultados.map((sugestao, index) => (
          <li
            key={`${sugestao.rotulo}-${sugestao.latitude}-${sugestao.longitude}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // mousedown em vez de click: o clique tiraria o foco do campo e fecharia a lista antes.
            onMouseDown={(event) => {
              event.preventDefault()
              choose(sugestao)
            }}
            onMouseEnter={() => setActive(index)}
            className={cn(
              'cursor-pointer border-b border-border px-3.5 py-2.5 text-xs last:border-b-0',
              index === active && 'bg-primary/30 text-maroon',
            )}
          >
            {sugestao.rotulo}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className={cn('-mt-3 mb-4.5 text-2xs', !status && 'sr-only')}>
        {status}
      </p>
    </div>
  )
}
