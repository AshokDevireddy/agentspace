export type TimePeriod = 'this_week' | 'this_month' | 'ytd'

export function getDateRangeForPeriod(period: TimePeriod): { startDate: string; endDate: string } {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`

  switch (period) {
    case 'this_week': {
      const dayOfWeek = today.getDay()
      const sunday = new Date(today)
      sunday.setDate(today.getDate() - dayOfWeek)
      return {
        startDate: sunday.toISOString().split('T')[0],
        endDate: todayStr
      }
    }
    case 'this_month':
      return {
        startDate: `${year}-${month}-01`,
        endDate: todayStr
      }
    case 'ytd':
      return {
        startDate: `${year}-01-01`,
        endDate: todayStr
      }
  }
}

export function formatDateRangeDisplay(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
}

export function getTimePeriodLabel(period: TimePeriod): string {
  switch (period) {
    case 'this_week': return 'This Week'
    case 'this_month': return 'This Month'
    case 'ytd': return 'YTD'
  }
}
