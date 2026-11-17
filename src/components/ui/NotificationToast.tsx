import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheck, CircleX, Info, ShieldAlert, X } from 'lucide-react'
import type { Notification, NotificationVariant } from '../../hooks/useNotifications'

const variants = {
  info: { icon: Info, surface: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950', accent: 'text-blue-600 dark:text-blue-300', bar: 'bg-blue-500' },
  warning: { icon: ShieldAlert, surface: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950', accent: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' },
  success: { icon: CircleCheck, surface: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950', accent: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' },
  error: { icon: CircleX, surface: 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950', accent: 'text-rose-600 dark:text-rose-300', bar: 'bg-rose-500' },
} satisfies Record<NotificationVariant, { icon: typeof Info; surface: string; accent: string; bar: string }>

export const NOTIFICATION_DURATION = 5000

export function NotificationToast({ notification, onDismiss }: { notification: Notification; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(notification.id), NOTIFICATION_DURATION)
    return () => window.clearTimeout(timer)
  }, [notification.id, onDismiss])

  const style = variants[notification.variant]
  const Icon = style.icon
  return (
    <div role={notification.variant === 'error' || notification.variant === 'warning' ? 'alert' : 'status'} aria-atomic="true" className={`notification-toast pointer-events-auto relative overflow-hidden rounded-xl border shadow-lg ${style.surface}`}>
      <div className="flex items-start gap-3 p-4">
        <Icon aria-hidden="true" className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${style.accent}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-5 text-foreground">{notification.title}</p>
          <p className="mt-1 break-words text-[12px] font-normal leading-5 text-muted-foreground [overflow-wrap:anywhere]">{notification.message}</p>
        </div>
        <button type="button" onClick={() => onDismiss(notification.id)} aria-label="Dismiss notification" className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div aria-hidden="true" className="h-[3px] bg-black/5 dark:bg-white/10">
        <div className={`notification-countdown h-full origin-left ${style.bar}`} style={{ animationDuration: `${NOTIFICATION_DURATION}ms` }} />
      </div>
    </div>
  )
}

export function NotificationViewport({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: (id: number) => void }) {
  return createPortal(
    <div aria-label="Notifications" role="region" className="pointer-events-none fixed right-4 top-4 z-[200] flex max-h-[calc(100dvh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto">
      {notifications.map((notification) => <NotificationToast key={notification.id} notification={notification} onDismiss={onDismiss} />)}
    </div>,
    document.body,
  )
}
