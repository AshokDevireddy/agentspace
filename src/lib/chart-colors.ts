/**
 * Chart Color Constants
 *
 * Centralized color definitions for consistent chart styling across the application.
 */

/** Purple color for cumulative values in charts */
export const CUMULATIVE_COLOR = "#8b5cf6"

/** Fixed age range colors - distinct and consistent */
export const AGE_RANGE_COLORS: Record<string, string> = {
  "18-30": "#2563eb",   // Blue
  "31-40": "#16a34a",   // Green
  "41-50": "#f59e0b",   // Amber/Orange
  "51-60": "#ef4444",   // Red
  "61-70": "#0891b2",   // Cyan
  "71+": "#ec4899",     // Pink
}

/**
 * Fixed carrier colors - distinct and consistent.
 * None of these colors overlap with CUMULATIVE_COLOR (#8b5cf6 - purple).
 * Colors are chosen to be visually distinct from each other.
 */
export const CARRIER_COLORS: Record<string, string> = {
  "Aetna": "#ef4444",           // Red-500
  "Aflac": "#60a5fa",           // Blue-400 (light blue)
  "American Amicable": "#f59e0b", // Amber/Orange
  "Occidental": "#f59e0b",       // Amber/Orange (same as American Amicable)
  "American Amicable / Occidental": "#f59e0b", // Amber/Orange
  "American Home Life Insurance Company": "#dc2626", // Red-600
  "Allstate": "#0891b2",        // Cyan-600
  "Combined": "#16a34a",        // Green-600
  "RNA": "#ec4899",             // Pink-500
  "Acme Life": "#84cc16",       // Lime-500
  "Corebridge": "#f97316",      // Orange-500
  "Ethos": "#6366f1",           // Indigo-500
  "FG Annuities": "#22c55e",    // Emerald-500
  "Foresters": "#eab308",       // Yellow-500
  "Foresters Financial": "#eab308", // Yellow-500 (alias)
  "Legal General": "#06b6d4",   // Sky Blue-500
  "Liberty Bankers": "#92400e", // Brown-700
  "Liberty Bankers Life (LBL)": "#92400e", // Brown-700 (alias)
  "LBL": "#92400e",             // Brown-700 (alias)
  "Mutual Omaha": "#f43f5e",    // Rose-500
  "National Life": "#059669",   // Emerald-600
  "SBLI": "#0ea5e9",            // Sky Blue-500
  "Transamerica": "#fb923c",    // Orange-400
  "United Home Life": "#34d399", // Emerald-400
}

/** Fallback colors for any carrier not in the predefined map */
export const FALLBACK_COLORS = [
  "#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#0891b2", "#14b8a6",
  "#ec4899", "#84cc16", "#f97316", "#6366f1", "#22c55e", "#eab308",
  "#06b6d4", "#f43f5e", "#059669", "#0ea5e9", "#fb923c", "#34d399",
]

/**
 * Get a color for a label, using a hash-based fallback for unknown labels.
 */
export function colorForLabel(label: string, explicitIndex?: number): string {
  if (typeof explicitIndex === "number") {
    return FALLBACK_COLORS[explicitIndex % FALLBACK_COLORS.length]
  }
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

/**
 * Get a color for a carrier label.
 * First checks for an exact match in CARRIER_COLORS, then case-insensitive,
 * and falls back to colorForLabel if no match is found.
 */
export function carrierColorForLabel(label: string, explicitIndex?: number): string {
  // Normalize the label: trim whitespace and check for exact match first
  const normalized = label.trim()

  // Check if we have a fixed color for this carrier (exact match)
  if (CARRIER_COLORS[normalized]) {
    return CARRIER_COLORS[normalized]
  }

  // Check case-insensitive match
  const lowerLabel = normalized.toLowerCase()
  for (const [key, value] of Object.entries(CARRIER_COLORS)) {
    if (key.toLowerCase() === lowerLabel) {
      return value
    }
  }

  // Fallback to generated color
  return colorForLabel(normalized, explicitIndex)
}
