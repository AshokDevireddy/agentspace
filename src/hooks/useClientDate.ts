import { useClientValue } from './useClientValue'

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
 * @param serverYear - Year to use on server (e.g., 2024)
 * @param serverMonth - Month to use on server (0-indexed, e.g., 0 for January)
 * @param serverDay - Day to use on server (e.g., 1)
 */
export function useClientDate(
  serverYear: number = 2024,
  serverMonth: number = 0,
  serverDay: number = 1
): DateInfo {
  return useClientValue<DateInfo>(
    // Server default - deterministic
    {
      date: new Date(serverYear, serverMonth, serverDay),
      year: serverYear,
      month: serverMonth,
      day: serverDay,
      dayOfWeek: new Date(serverYear, serverMonth, serverDay).getDay(),
      isoDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-${String(serverDay).padStart(2, '0')}`,
      isoMonth: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}`
    },
    // Client value - actual current date
    () => {
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
    }
  )
}

/**
 * Calculate week date range (Sunday to Saturday) in SSR-safe way.
 */
export function useWeekDateRange(serverYear: number = 2024, serverMonth: number = 0, serverDay: number = 1) {
  return useClientValue(
    // Server default - a fixed week range
    {
      startDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-01`,
      endDate: `${serverYear}-${String(serverMonth + 1).padStart(2, '0')}-07`
    },
    // Client value - actual current week
    () => {
      const today = new Date()
      const dayOfWeek = today.getDay()
      const sunday = new Date(today)
      sunday.setDate(today.getDate() - dayOfWeek)
      sunday.setHours(0, 0, 0, 0)
      const saturday = new Date(sunday)
      saturday.setDate(sunday.getDate() + 6)
      saturday.setHours(23, 59, 59, 999)
      return {
        startDate: sunday.toISOString().split('T')[0],
        endDate: saturday.toISOString().split('T')[0]
      }
    }
  )
}
