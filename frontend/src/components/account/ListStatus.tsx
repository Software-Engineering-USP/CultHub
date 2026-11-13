interface ListStatusProps {
  loading: boolean
  error: string | null
  empty: boolean
  emptyMessage: string
}

/** Carregando, erro ou lista vazia; não renderiza nada quando há itens para mostrar. */
export default function ListStatus({ loading, error, empty, emptyMessage }: Readonly<ListStatusProps>) {
  if (loading) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Carregando…
      </p>
    )
  }
  if (error) {
    return (
      <p role="alert" className="border-destructive/30 bg-destructive/5 rounded-xl border p-4 text-sm">
        {error}
      </p>
    )
  }
  if (empty) return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  return null
}
