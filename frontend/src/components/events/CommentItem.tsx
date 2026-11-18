import { useState } from 'react'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import CommentEditor from '@/components/events/CommentEditor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/services/api'
import { formatCommentDate } from '@/services/comments'
import type { EventComment } from '@/types'

/** Com COMENTARIOS_PROFUNDIDADE_MAXIMA = 1 no backend, só se responde a comentários de primeiro nível. */
const MAX_REPLY_LEVEL = 0

export interface CommentActions {
  onReply: (commentId: string, text: string) => Promise<void>
  onUpdate: (commentId: string, text: string) => Promise<void>
  onRemove: (commentId: string) => Promise<void>
}

interface CommentItemProps extends CommentActions {
  comment: EventComment
  /** Usuário logado (pode responder). */
  canReply: boolean
}

export default function CommentItem({ comment, canReply, ...actions }: Readonly<CommentItemProps>) {
  const { onReply, onUpdate, onRemove } = actions
  const [mode, setMode] = useState<'idle' | 'reply' | 'edit'>('idle')
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const isReply = comment.level > 0
  const authorName = comment.author?.name ?? 'Comentário removido'

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
    <article
      aria-label={comment.removed ? 'Comentário removido' : `Comentário de ${authorName}`}
      className={cn(
        isReply
          ? 'mt-4 border-l-2 border-border pl-4'
          : 'border-b border-border py-5.5 first:pt-0 last:border-b-0 last:pb-0',
      )}
    >
      {comment.removed ? (
        <p className="text-xs text-muted-foreground italic">Este comentário foi removido.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3 text-xs">
            {comment.author && (
              <InitialsAvatar initials={comment.author.initials} size="sm" aria-hidden="true" />
            )}
            <div>
              <strong>{authorName}</strong>
              <p className="text-muted-foreground">
                <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
                {comment.editedAt && ' • editado'}
              </p>
            </div>
          </div>

          {mode === 'edit' ? (
            <CommentEditor
              label="Editar seu comentário"
              submitLabel="Salvar"
              initialText={comment.text ?? ''}
              onSubmit={async (text) => {
                await onUpdate(comment.id, text)
                setMode('idle')
              }}
              onCancel={() => setMode('idle')}
            />
          ) : (
            <p className="leading-relaxed whitespace-pre-line">{comment.text}</p>
          )}

          {mode === 'idle' && (
            <div className="mt-2 flex gap-4.5">
              {canReply && comment.level <= MAX_REPLY_LEVEL && (
                <Button
                  variant="linkMuted"
                  aria-label={`Responder a ${authorName}`}
                  onClick={() => setMode('reply')}
                >
                  Responder
                </Button>
              )}
              {comment.mine && (
                <>
                  <Button variant="linkMuted" onClick={() => setMode('edit')}>
                    Editar
                  </Button>
                  <Button variant="linkMuted" onClick={() => void remove()} disabled={removing}>
                    {removing ? 'Excluindo…' : 'Excluir'}
                  </Button>
                </>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {error}
            </p>
          )}
        </>
      )}

      {mode === 'reply' && (
        <CommentEditor
          label={`Sua resposta a ${authorName}`}
          submitLabel="Responder"
          placeholder="Escreva sua resposta..."
          onSubmit={async (text) => {
            await onReply(comment.id, text)
            setMode('idle')
          }}
          onCancel={() => setMode('idle')}
        />
      )}

      {comment.replies.map((reply) => (
        <CommentItem key={reply.id} comment={reply} canReply={canReply} {...actions} />
      ))}
    </article>
  )
}
