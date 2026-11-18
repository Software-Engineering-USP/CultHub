import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import CommentEditor from '@/components/events/CommentEditor'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/paths'
import { ApiError } from '@/services/api'
import { formatCommentDate } from '@/services/comments'
import type { MyComment } from '@/types'

interface MyCommentItemProps {
  comment: MyComment
  onUpdate: (commentId: string, text: string) => Promise<void>
  onRemove: (commentId: string) => Promise<void>
}

/** Comentário do usuário na conta, com link para o evento, editar e excluir. */
export default function MyCommentItem({ comment, onUpdate, onRemove }: Readonly<MyCommentItemProps>) {
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (!window.confirm('Excluir este comentário?')) return
    setRemoving(true)
    setError('')
    try {
      await onRemove(comment.id)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível excluir o comentário.')
      setRemoving(false)
    }
  }

  return (
    <article className="border-b border-line py-[22px] first:pt-0 last:border-b-0">
      <Link
        to={paths.event(comment.event.id)}
        className="mb-[10px] block text-[13px] font-bold text-maroon underline"
      >
        {comment.event.title} <ArrowUpRight className="inline size-4" />
      </Link>
      <p className="text-[13px] leading-[1.8] text-muted-foreground">
        {comment.level > 0 ? 'Resposta' : 'Comentário'} •{' '}
        <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
        {comment.editedAt && ' • editado'}
      </p>

      {editing ? (
        <CommentEditor
          label="Editar seu comentário"
          submitLabel="Salvar"
          initialText={comment.text}
          onSubmit={async (text) => {
            await onUpdate(comment.id, text)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <p className="mt-[10px] text-[13px] leading-[1.8] whitespace-pre-line">{comment.text}</p>
          <div className="mt-[10px] flex gap-[18px]">
            <Button variant="linkMuted" onClick={() => setEditing(true)} className="mt-2">
              Editar
            </Button>
            <Button variant="linkMuted" onClick={() => void remove()} disabled={removing} className="mt-2">
              {removing ? 'Excluindo…' : 'Excluir'}
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </article>
  )
}
