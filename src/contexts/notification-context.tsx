'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react'
import { BannerNotification, Notification, NotificationType } from '@/components/banner-notification'

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, duration?: number) => void
  showSuccess: (message: string, duration?: number) => void
  showError: (message: string, duration?: number) => void
  showWarning: (message: string, duration?: number) => void
  showInfo: (message: string, duration?: number) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const STORAGE_KEY = 'app-notifications'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Load notifications from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setNotifications(parsed)
          // Clear from storage after loading
          sessionStorage.removeItem(STORAGE_KEY)
        } catch (e) {
          console.error('Failed to parse stored notifications:', e)
        }
      }
    }
  }, [])

  const showNotification = useCallback((
    message: string,
    type: NotificationType = 'info',
    duration: number = 5000
  ) => {
    const id = `notification-${Date.now()}-${Math.random()}`
    const notification: Notification = {
      id,
      type,
      message,
      duration,
    }

    // Stack up to 3 notifications, removing oldest if limit exceeded
    setNotifications((prev) => {
      const MAX_NOTIFICATIONS = 3
      const updated = [...prev, notification]
      // Remove oldest notifications if we exceed the limit
      const newNotifications = updated.slice(-MAX_NOTIFICATIONS)

      // Store in sessionStorage so it persists across navigation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newNotifications))
      }

      return newNotifications
    })
  }, [])

  const showSuccess = useCallback((message: string, duration: number = 5000) => {
    showNotification(message, 'success', duration)
  }, [showNotification])

  const showError = useCallback((message: string, duration: number = 7000) => {
    showNotification(message, 'error', duration)
  }, [showNotification])

  const showWarning = useCallback((message: string, duration: number = 6000) => {
    showNotification(message, 'warning', duration)
  }, [showNotification])

  const showInfo = useCallback((message: string, duration: number = 5000) => {
    showNotification(message, 'info', duration)
  }, [showNotification])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id)
      if (typeof window !== 'undefined') {
        if (filtered.length === 0) {
          sessionStorage.removeItem(STORAGE_KEY)
        } else {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        }
      }
      return filtered
    })
  }, [])

  const contextValue = useMemo(() => ({
    showNotification, showSuccess, showError, showWarning, showInfo, removeNotification
  }), [showNotification, showSuccess, showError, showWarning, showInfo, removeNotification])

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      {/* Notification Container - Fixed to top right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          {notifications.map((notification) => (
            <BannerNotification
              key={notification.id}
              notification={notification}
              onClose={removeNotification}
            />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
