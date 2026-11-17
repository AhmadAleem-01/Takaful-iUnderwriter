import { useCallback, useState } from 'react'

export type NotificationVariant = 'info' | 'warning' | 'success' | 'error'
export type Notification = { id: number; variant: NotificationVariant; title: string; message: string }

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const dismiss = useCallback((id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }, [])
  const notify = useCallback((notification: Omit<Notification, 'id'>) => {
    setNotifications((current) => [...current.slice(-3), { ...notification, id: nextNotificationId++ }])
  }, [])
  return { notifications, notify, dismiss }
}

let nextNotificationId = 1
