/**
 * Timezone utility for converting the current time to an agency's configured timezone.
 * Uses Intl.DateTimeFormat.formatToParts() for reliable, cross-platform timezone conversion.
 */

export const DEFAULT_TIMEZONE = 'America/Los_Angeles'

export interface DatePartsInTimezone {
  date: Date
  year: number
  month: number   // 0-indexed (matches JS Date convention)
  day: number
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
  isoDate: string  // YYYY-MM-DD
  isoMonth: string // YYYY-MM
}

export function getDatePartsInTimezone(timezone: string): DatePartsInTimezone {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find(p => p.type === 'year')!.value)
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1
  const day = parseInt(parts.find(p => p.type === 'day')!.value)
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const dayOfWeek = tzDate.getDay()

  return {
    date: tzDate,
    year,
    month,
    day,
    dayOfWeek,
    isoDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    isoMonth: `${year}-${String(month + 1).padStart(2, '0')}`,
  }
}
