/**
 * Date Utility Functions
 *
 * Centralized date range and date manipulation utilities.
 */

export interface DateRange {
  start: string;
  end: string;
}

/**
 * Get Year-to-Date (YTD) date range from January 1st to today
 * @returns DateRange object with start and end dates in YYYY-MM-DD format
 */
export function getYTDDateRange(): DateRange {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return {
    start: `${year}-01-01`,
    end: todayStr
  };
}

/**
 * Get Month-to-Date (MTD) date range from the 1st of current month to today
 * @returns DateRange object with start and end dates in YYYY-MM-DD format
 */
export function getMTDDateRange(): DateRange {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return {
    start: `${year}-${month}-01`,
    end: todayStr
  };
}

/**
 * Format an ISO date string as "Month DD, YYYY" for display (e.g. billing dates)
 */
export function formatRenewalDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not available'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export function formatDateToYYYYMMDD(date: Date | string, timezone: string = DEFAULT_TIMEZONE): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
