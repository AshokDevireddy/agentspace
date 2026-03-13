import { useMemo, useCallback } from 'react'
import { useClientValue } from './useClientValue'
import { formatDateToYYYYMMDD, DEFAULT_TIMEZONE } from '@/lib/date-utils'

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
 * @param serverYear - Year to use on server (defaults to current year)
 * @param serverMonth - Month to use on server (0-indexed, defaults to current month)
 * @param serverDay - Day to use on server (defaults to current day)
 */
export function useClientDate(
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
  }, [])

  return useClientValue<DateInfo>(serverDefault, getClientValue)
}

/**
 * Calculate week date range (Sunday to Saturday) in SSR-safe way.
 */
export function useWeekDateRange(
  serverYear: number = new Date().getFullYear(),
  serverMonth: number = new Date().getMonth(),
  serverDay: number = new Date().getDate(),
  timezone: string = DEFAULT_TIMEZONE
) {
  const serverDefault = useMemo(() => ({
    startDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-01`,
    endDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-07`
  }), [serverYear, serverMonth, serverDay])

  const getClientValue = useCallback(() => {
    const now = new Date()
    // Get day-of-week in agency timezone
    const weekdayStr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now)
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const dayOfWeek = dayMap[weekdayStr] ?? 0

    const sunday = new Date(now)
    sunday.setDate(now.getDate() - dayOfWeek)
    sunday.setHours(0, 0, 0, 0)
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    saturday.setHours(23, 59, 59, 999)
    return {
      startDate: formatDateToYYYYMMDD(sunday, timezone),
      endDate: formatDateToYYYYMMDD(saturday, timezone)
    }
  }, [timezone])

  return useClientValue(serverDefault, getClientValue)
}
