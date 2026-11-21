import { Bell, CalendarDays, CheckCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { paths } from '@/lib/paths'
import { api, ApiError } from '@/services/api'
import type { ApiNotification } from '@/services/api'

function dateLabel(notification: ApiNotification): string {
  const [year, month, day] = notification.data_inicio.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const sameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  let label = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(date)
  if (sameDay(date, today)) label = 'Hoje'
  else if (sameDay(date, tomorrow)) label = 'Amanhã'
  return notification.hora_inicio ? `${label} às ${notification.hora_inicio.slice(0, 5)}` : label
}

function errorMessage(error: unknown, fallback = 'Não foi possível carregar as notificações.'): string {
  return error instanceof ApiError ? error.message : fallback
}

export default function NotificationsMenu() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const notificationsRef = useRef<ApiNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [open, setOpen] = useState(false)

  const replaceNotifications = useCallback((next: ApiNotification[]) => {
    notificationsRef.current = next
    setNotifications(next)
  }, [])

  const load = useCallback(async (eventId?: string, showLoading = true) => {
    if (showLoading) {
      setLoading(true)
      setError('')
    }
    try {
      const response = await api.notifications.list()
      notificationsRef.current = response.resultados
      setNotifications(response.resultados)
      setUnreadCount(response.nao_lidas)
      const eventNotification = response.resultados.find((notification) => notification.evento_id === eventId)
      if (eventId && eventNotification && !eventNotification.lida_em) {
        setOpen(true)
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadInitialNotifications() {
      try {
        const response = await api.notifications.list()
        if (!active) return
        notificationsRef.current = response.resultados
        setNotifications(response.resultados)
        setUnreadCount(response.nao_lidas)
      } catch (cause) {
        if (active) setError(errorMessage(cause))
      }
    }

    void loadInitialNotifications()

    function handleNotificationsChanged(event: Event) {
      const { eventId } = (event as CustomEvent<{ eventId: string }>).detail
      void load(eventId, false)
    }

    window.addEventListener('culthub:notifications-updated', handleNotificationsChanged)
    return () => {
      active = false
      window.removeEventListener('culthub:notifications-updated', handleNotificationsChanged)
    }
  }, [load])

  async function markRead(id: string): Promise<void> {
    try {
      await api.notifications.markRead(id)
      const current = notificationsRef.current
      const wasUnread = current.some((notification) => notification.id === id && !notification.lida_em)
      const updated = current.map((notification) =>
        notification.id === id
          ? { ...notification, lida_em: notification.lida_em ?? new Date().toISOString() }
          : notification,
      )
      replaceNotifications(updated)
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1))
      setActionError('')
    } catch (cause) {
      setActionError(errorMessage(cause, 'Não foi possível marcar esta notificação como lida.'))
    }
  }

  async function markAllRead() {
    try {
      await api.notifications.markAllRead()
      const now = new Date().toISOString()
      replaceNotifications(
        notificationsRef.current.map((item) => ({ ...item, lida_em: item.lida_em ?? now })),
      )
      setUnreadCount(0)
      setActionError('')
    } catch (cause) {
      setActionError(errorMessage(cause, 'Não foi possível marcar todas as notificações como lidas.'))
    }
  }

  const unreadLabel = unreadCount === 1 ? '1 não lida' : `${unreadCount} não lidas`

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (nextOpen) {
            setActionError('')
            void load()
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Notificações, ${unreadLabel}`}
            className="relative grid size-11 place-items-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Bell aria-hidden="true" className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-maroon px-1 text-[10px] leading-none font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent aria-label="Notificações" className="w-96 bg-background p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-bold">Notificações</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Lembretes de eventos salvos ou confirmados.
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="linkMuted"
                className="inline-flex items-center gap-1.5"
                onClick={() => void markAllRead()}
              >
                <CheckCheck aria-hidden="true" className="size-4" />
                Ler todas
              </Button>
            )}
          </div>

          {error && (
            <output className="block px-5 py-4 text-sm text-destructive" aria-live="polite">
              {error}
            </output>
          )}
          {loading && !error && (
            <output className="block px-5 py-5 text-sm text-muted-foreground" aria-live="polite">
              Carregando notificações…
            </output>
          )}
          {!loading && !error && notifications.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Você não tem lembretes de eventos próximos.
            </p>
          )}
          {!loading && !error && notifications.length > 0 && (
            <ul className="max-h-105 divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    to={paths.event(notification.evento_id)}
                    onClick={() => {
                      if (notification.lida_em) {
                        setOpen(false)
                        return
                      }
                      void markRead(notification.id)
                      setOpen(false)
                    }}
                    className="flex gap-3 px-5 py-4 text-inherit no-underline transition-colors hover:bg-accent"
                  >
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-maroon/10 text-maroon">
                      <CalendarDays aria-hidden="true" className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <strong className="text-sm leading-snug">{notification.titulo_evento}</strong>
                        {!notification.lida_em && (
                          <>
                            <span
                              aria-hidden="true"
                              className="mt-1.5 size-2 shrink-0 rounded-full bg-maroon"
                            />
                            <span className="sr-only">Não lida</span>
                          </>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {dateLabel(notification)} · {notification.local}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      {actionError && (
        <output
          className="fixed right-4 bottom-4 z-50 rounded-xl border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-lg"
          role="alert"
        >
          {actionError}
        </output>
      )}
    </>
  )
}
