import type { FormEvent } from 'react'

/**
 * onSubmit que cancela o envio padrão do navegador e entrega os campos do formulário (pelo `name`).
 * Aceita FormEvent de qualquer elemento para funcionar também com <Surface as="form">.
 */
export function onFormSubmit(handler: (data: FormData, form: HTMLFormElement) => void) {
  return (event: FormEvent<HTMLElement>) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    handler(new FormData(form), form)
  }
}

/** Valor de texto de um campo (string vazia se não existir). */
export function text(data: FormData, name: string): string {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}
