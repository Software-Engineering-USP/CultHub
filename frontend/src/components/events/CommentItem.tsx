import type { EventComment } from '../../data/events'
import Avatar from '../ui/Avatar'
import TextButton from '../ui/TextButton'

export default function CommentItem({ comment }: { comment: EventComment }) {
  return (
    <article className="border-b border-line py-[22px] first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-3 flex items-center gap-3 text-[12px]">
        <Avatar size="sm" aria-hidden="true">
          {comment.initials}
        </Avatar>
        <div>
          <strong>{comment.author}</strong>
          <p className="text-[13px] leading-[1.8] text-muted">Perfil fictício • comentário de exemplo</p>
        </div>
      </div>
      <p className="text-[13px] leading-[1.8]">{comment.text}</p>
      <TextButton
        disabled
        aria-label={`Responder a ${comment.author} (indisponível na demonstração)`}
        className="mt-2"
      >
        Responder
      </TextButton>
    </article>
  )
}
