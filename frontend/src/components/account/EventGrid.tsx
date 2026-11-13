import ListStatus from '@/components/account/ListStatus'
import EventCard from '@/components/events/EventCard'
import type { UserEventsResult } from '@/hooks/useUserEvents'

interface EventGridProps extends UserEventsResult {
  emptyMessage: string
}

export default function EventGrid({ events, loading, error, emptyMessage }: Readonly<EventGridProps>) {
  if (loading || error || !events.length) {
    return <ListStatus loading={loading} error={error} empty={!events.length} emptyMessage={emptyMessage} />
  }

  return (
    <div className="grid grid-cols-2 gap-5.5 max-sm:grid-cols-1">
      {events.map((event) => (
        <EventCard key={event.id} event={event} compact />
      ))}
    </div>
  )
}
