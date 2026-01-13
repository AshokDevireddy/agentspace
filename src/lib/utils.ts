import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts HSL color string to RGB values
 * @param hsl - HSL color string in format "hue saturation% lightness%" (e.g., "217 91% 60%")
 * @returns RGB object with r, g, b values (0-255)
 */
function hslToRgb(hsl: string): { r: number; g: number; b: number } {
  const [h, s, l] = hsl.split(' ').map((v, i) => {
    const num = parseFloat(v.replace('%', ''))
    return i === 0 ? num : num / 100
  })

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

/**
 * Calculates the relative luminance of an RGB color
 * Uses the formula from WCAG 2.0
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Determines if white or black text provides better contrast on a given background color
 * @param hslColor - HSL color string in format "hue saturation% lightness%" (e.g., "217 91% 60%")
 * @returns 'white' or 'black' depending on which provides better contrast
 */
export function getContrastTextColor(hslColor: string): 'white' | 'black' {
  try {
    const { r, g, b } = hslToRgb(hslColor)
    const luminance = getLuminance(r, g, b)

    // If luminance > 0.5, the color is light, so use black text
    // If luminance <= 0.5, the color is dark, so use white text
    return luminance > 0.5 ? 'black' : 'white'
  } catch (error) {
    // Fallback to white if there's an error parsing the color
    return 'white'
  }
}

/**
 * Calculates monthly premium from annual premium based on billing cycle
 */
export function calculateMonthlyPremium(annualPremium: number, billingCycle: string): number {
  const frequencies: Record<string, number> = {
    'monthly': 12,
    'quarterly': 4,
    'semi-annually': 2,
    'annually': 1
  }
  const divisor = frequencies[billingCycle?.toLowerCase()] || 12
  return annualPremium / divisor
}

/**
 * Calculates the next draft date based on effective date and billing cycle
 */
export function calculateNextDraftDate(effectiveDate: string, billingCycle: string): Date | null {
  if (!effectiveDate) return null

  const effective = new Date(effectiveDate + 'T00:00:00')
  if (isNaN(effective.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monthsToAdd: Record<string, number> = {
    'monthly': 1,
    'quarterly': 3,
    'semi-annually': 6,
    'annually': 12
  }

  const interval = monthsToAdd[billingCycle?.toLowerCase()] || 1

  let nextDraft = new Date(effective)
  const originalDayOfMonth = effective.getDate()

  // Keep adding intervals until we find a date in the future
  while (nextDraft <= today) {
    const newMonth = nextDraft.getMonth() + interval
    const newYear = nextDraft.getFullYear() + Math.floor(newMonth / 12)
    const normalizedMonth = newMonth % 12

    // Get the last day of the target month to handle overflow
    // (e.g., Jan 31 + 1 month should be Feb 28, not Mar 3)
    const lastDayOfTargetMonth = new Date(newYear, normalizedMonth + 1, 0).getDate()

    // Use the original day or the last day of month, whichever is smaller
    const dayToUse = Math.min(originalDayOfMonth, lastDayOfTargetMonth)

    nextDraft = new Date(newYear, normalizedMonth, dayToUse)
  }

  return nextDraft
}
