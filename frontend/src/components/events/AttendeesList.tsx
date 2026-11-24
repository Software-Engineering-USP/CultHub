import { Link } from 'react-router-dom'
import ListStatus from '@/components/account/ListStatus'
import InitialsAvatar from '@/components/common/InitialsAvatar'
import { Button } from '@/components/ui/button'
import { useAttendees } from '@/hooks/useAttendees'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { paths } from '@/lib/paths'

interface AttendeesListProps {
  eventId: string
  /** Muda quando o usuário marca ou desmarca presença, para a lista recarregar. */
  version?: number | string
}

/** Quem vai ao evento, com link para o perfil de cada pessoa. Só aparece para quem está logado. */
export default function AttendeesList({ eventId, version }: Readonly<AttendeesListProps>) {
  const user = useCurrentUser()
  const { attendees, loading, loadingMore, error, hasMore, loadMore } = useAttendees(eventId, version)
  if (!user) return null

  return (
    <section aria-labelledby="quem-vai-titulo" className="mb-3">
      <h2 id="quem-vai-titulo" className="mb-2 text-sm font-bold">
        Quem vai
      </h2>
      <ListStatus
        loading={loading}
        error={attendees.length ? null : error}
        empty={!attendees.length}
        emptyMessage="Ninguém confirmou presença ainda."
      />
      {attendees.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attendees.map((attendee) => (
            <li key={attendee.id}>
              <Link
                to={paths.user(attendee.id)}
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-xs font-semibold text-foreground no-underline hover:text-maroon hover:underline"
              >
                <InitialsAvatar
                  initials={attendee.initials}
                  size="sm"
                  className="data-[size=sm]:size-7"
                  aria-hidden="true"
                />
                {attendee.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {attendees.length > 0 && error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {hasMore && (
        <Button variant="linkMuted" className="mt-1" onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? 'Carregando…' : 'Ver mais'}
        </Button>
      )}
    </section>
  )
}
