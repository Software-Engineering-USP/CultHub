import { useState } from 'react'
import { Link } from 'react-router-dom'
import ListStatus from '@/components/account/ListStatus'
import DemoNote from '@/components/common/DemoNote'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import SectionHeading from '@/components/common/SectionHeading'
import Surface from '@/components/common/Surface'
import CommentItem from '@/components/events/CommentItem'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useComments } from '@/hooks/useComments'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { onFormSubmit, text } from '@/lib/forms'
import { paths } from '@/lib/paths'
import { ApiError } from '@/services/api'

function countLabel(count: number): string {
  if (count === 0) return 'Nenhum comentário ainda'
  return count === 1 ? '1 comentário' : `${count} comentários`
}

/** Comentários do evento: lista com respostas e o formulário para comentar. */
export default function CommentsSection({ eventId }: Readonly<{ eventId: string }>) {
  const user = useCurrentUser()
  const { comments, count, loading, loadingMore, error, hasMore, loadMore, create, reply, update, remove } =
    useComments(eventId)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')

  return (
    <section aria-labelledby="comentarios-titulo">
      <SectionHeading
        id="comentarios-titulo"
        title="Comentários"
        description={`${loading ? 'Carregando' : countLabel(count)} • Compartilhe o seu olhar sobre a experiência.`}
      />

      <Surface
        as="form"
        aria-label="Novo comentário"
        aria-describedby="comentario-aviso"
        onSubmit={onFormSubmit((data, form) => {
          const value = text(data, 'comentario').trim()
          if (!value) {
            setFormError('Escreva algo antes de enviar.')
            return
          }
          setSending(true)
          setFormError('')
          create(value)
            .then(() => form.reset())
            .catch((cause: unknown) =>
              setFormError(
                cause instanceof ApiError
                  ? cause.message
                  : 'Não foi possível publicar o comentário. Tente novamente.',
              ),
            )
            .finally(() => setSending(false))
        })}
        className="mb-5.5"
      >
        <div className="mb-4.5 flex items-center gap-3 text-xs">
          {user ? (
            <>
              <InitialsAvatar initials={user.initials} size="sm" aria-hidden="true" />
              <p>
                Comentando como <strong>{user.name}</strong>
              </p>
            </>
          ) : (
            <p>
              <Link to={paths.signIn} className="font-semibold text-maroon underline">
                Entre
              </Link>{' '}
              para comentar.
            </p>
          )}
        </div>

        <Label className="sr-only" htmlFor="comentario">
          Seu comentário sobre o evento
        </Label>
        <Textarea
          id="comentario"
          name="comentario"
          required
          disabled={!user || sending}
          aria-invalid={formError ? true : undefined}
          aria-describedby={formError ? 'comentario-erro' : undefined}
          placeholder="Escreva seu comentário sobre o evento..."
        />
        {formError && (
          <p id="comentario-erro" role="alert" className="mt-1.5 text-xs text-destructive">
            {formError}
          </p>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-4.5 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <DemoNote id="comentario-aviso">Compartilhe ideias com respeito.</DemoNote>
          <Button type="submit" className="max-sm:w-full" disabled={!user || sending}>
            {sending ? 'Publicando…' : 'Publicar comentário'}
          </Button>
        </div>
      </Surface>

      <Surface>
        <ListStatus
          loading={loading}
          error={comments.length ? null : error}
          empty={!comments.length}
          emptyMessage="Seja a primeira pessoa a comentar sobre este evento."
        />
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            canReply={Boolean(user)}
            onReply={reply}
            onUpdate={update}
            onRemove={remove}
          />
        ))}
        {comments.length > 0 && error && (
          <p role="alert" className="mt-4 text-xs text-destructive">
            {error}
          </p>
        )}
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais comentários'}
          </Button>
        )}
      </Surface>
    </section>
  )
}
