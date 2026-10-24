import type { FormEvent } from 'react'

/** Os formulários ainda são demonstrativos: nada é enviado. */
export function preventSubmit(event: FormEvent): void {
  event.preventDefault()
}
