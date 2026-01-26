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
 * Format a date string to YYYY-MM-DD format
 * @param date - Date object or date string
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateToYYYYMMDD(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
