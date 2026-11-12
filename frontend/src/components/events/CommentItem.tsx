import InitialsAvatar from '@/components/common/InitialsAvatar'
import { Button } from '@/components/ui/button'
import { logDemoAction } from '@/lib/demo'
import type { EventComment } from '@/types'

export default function CommentItem({ comment }: Readonly<{ comment: EventComment }>) {
  return (
    <article className="border-b border-border py-5.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-3 flex items-center gap-3 text-xs">
        <InitialsAvatar initials={comment.initials} size="sm" aria-hidden="true" />
        <div>
          <strong>{comment.author}</strong>
          <p className="text-muted-foreground">Perfil fictício • comentário de exemplo</p>
        </div>
      </div>
      <p className="leading-relaxed">{comment.text}</p>
      <Button
        variant="linkMuted"
        aria-label={`Responder a ${comment.author}`}
        onClick={() => logDemoAction('Abrir resposta ao comentário', { commentId: comment.id })}
        className="mt-2"
      >
        Responder
      </Button>
    </article>
  )
}
