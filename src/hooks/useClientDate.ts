import { useMemo, useCallback } from 'react'
import { useClientValue } from './useClientValue'
import { getDatePartsInTimezone } from '@/lib/timezone'

export interface DateInfo {
  date: Date
  year: number
  month: number  // 0-indexed
  day: number
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  isoDate: string  // YYYY-MM-DD
  isoMonth: string // YYYY-MM
}

/**
 * Server-safe date hook. Returns deterministic defaults on server,
 * actual current date on client.
 *
 * @param timezone - Optional IANA timezone (e.g. 'America/New_York'). When provided,
 *   the client value is calculated in that timezone instead of browser-local time.
 * @param serverYear - Year to use on server (defaults to current year)
 * @param serverMonth - Month to use on server (0-indexed, defaults to current month)
 * @param serverDay - Day to use on server (defaults to current day)
 */
export function useClientDate(
  timezone?: string,
  serverYear: number = new Date().getFullYear(),
  serverMonth: number = new Date().getMonth(),
  serverDay: number = new Date().getDate()
): DateInfo {
  // Memoize server default to avoid creating new object each render
  const serverDefault = useMemo(() => ({
    date: new Date(serverYear, serverMonth, serverDay),
    year: serverYear,
    month: serverMonth,
    day: serverDay,
    dayOfWeek: new Date(serverYear, serverMonth, serverDay).getDay(),
    isoDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-${String(serverDay).padStart(2, '0')}`,
    isoMonth: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}`
  }), [serverYear, serverMonth, serverDay])

  // Memoize the getter function to ensure stable reference
  const getClientValue = useCallback(() => {
    if (timezone) {
      return getDatePartsInTimezone(timezone)
    }
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()
    const dayOfWeek = now.getDay()
    return {
      date: now,
      year,
      month,
      day,
      dayOfWeek,
      isoDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isoMonth: `${year}-${String(month + 1).padStart(2, '0')}`
    }
  }, [timezone])

  return useClientValue<DateInfo>(serverDefault, getClientValue)
}

/**
 * Calculate week date range (Sunday to Saturday) in SSR-safe way.
 *
 * @param timezone - Optional IANA timezone. When provided, week boundaries
 *   are calculated relative to the current date in that timezone.
 */
export function useWeekDateRange(timezone?: string, serverYear: number = new Date().getFullYear(), serverMonth: number = new Date().getMonth(), serverDay: number = new Date().getDate()) {
  // Memoize server default
  const serverDefault = useMemo(() => ({
    startDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-01`,
    endDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-07`
  }), [serverYear, serverMonth, serverDay])

  // Memoize the getter function
  const getClientValue = useCallback(() => {
    let today: Date
    if (timezone) {
      today = getDatePartsInTimezone(timezone).date
    } else {
      today = new Date()
    }
    const dayOfWeek = today.getDay()
    const sunday = new Date(today)
    sunday.setDate(today.getDate() - dayOfWeek)
    sunday.setHours(0, 0, 0, 0)
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    saturday.setHours(23, 59, 59, 999)

    const formatDate = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    return {
      startDate: formatDate(sunday),
      endDate: formatDate(saturday)
    }
  }, [timezone])

  return useClientValue(serverDefault, getClientValue)
}
