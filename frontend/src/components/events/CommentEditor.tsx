import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { onFormSubmit, text } from '@/lib/forms'
import { ApiError } from '@/services/api'

interface CommentEditorProps {
  /** Rótulo do campo (para leitores de tela). */
  label: string
  submitLabel: string
  initialText?: string
  placeholder?: string
  /** Lança ApiError em caso de falha; o editor mostra a mensagem. */
  onSubmit: (text: string) => Promise<void>
  onCancel: () => void
}

/** Campo inline para responder ou editar um comentário. */
export default function CommentEditor({
  label,
  submitLabel,
  initialText = '',
  placeholder,
  onSubmit,
  onCancel,
}: Readonly<CommentEditorProps>) {
  const id = useId()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  return (
    <form
      className="mt-3"
      onSubmit={onFormSubmit((data) => {
        const value = text(data, 'texto').trim()
        if (!value) {
          setError('Escreva algo antes de enviar.')
          return
        }
        setSending(true)
        setError('')
        onSubmit(value).catch((cause: unknown) => {
          setError(cause instanceof ApiError ? cause.message : 'Não foi possível enviar. Tente novamente.')
          setSending(false)
        })
      })}
    >
      <Label className="sr-only" htmlFor={id}>
        {label}
      </Label>
      <Textarea
        id={id}
        name="texto"
        required
        defaultValue={initialText}
        placeholder={placeholder}
        disabled={sending}
        autoFocus
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erro` : undefined}
        className="min-h-20"
      />
      {error && (
        <p id={`${id}-erro`} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2.5 flex gap-2.5">
        <Button type="submit" size="sm" disabled={sending}>
          {sending ? 'Enviando…' : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={sending}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
