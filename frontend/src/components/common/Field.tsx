import type { ComponentProps, ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FieldProps extends ComponentProps<'input'> {
  id: string
  label: string
  help?: ReactNode
}

/** Campo de formulário com rótulo e texto de ajuda opcional. */
export default function Field({ id, label, help, ...rest }: FieldProps) {
  const helpId = `${id}-ajuda`
  return (
    <div className="mb-4.5 grid min-w-0 content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={help ? helpId : undefined} {...rest} />
      {help && (
        <small id={helpId} className="text-2xs text-muted-foreground">
          {help}
        </small>
      )}
    </div>
  )
}
