import type { InputHTMLAttributes, ReactNode } from 'react'
import { inputClass } from '../../lib/classes'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  help?: ReactNode
}

/** Campo de formulário com rótulo e texto de ajuda opcional. */
export default function Field({ id, label, help, ...rest }: FieldProps) {
  const helpId = `${id}-ajuda`
  return (
    <div className="mb-[18px] grid min-w-0 gap-[7px]">
      <label htmlFor={id} className="text-[12px] font-[650]">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={help ? helpId : undefined}
        className={`${inputClass} min-h-[46px] w-full`}
        {...rest}
      />
      {help && (
        <small id={helpId} className="text-[10px] text-muted">
          {help}
        </small>
      )}
    </div>
  )
}
