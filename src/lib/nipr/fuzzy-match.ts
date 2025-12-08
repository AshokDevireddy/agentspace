/**
 * Fuzzy Matching Utilities for Carrier Name Matching
 * Uses Levenshtein distance for string similarity comparison
 */

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance normalized by max length
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  // Levenshtein distance calculation
  const matrix: number[][] = []
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[s1.length][s2.length]
  const maxLength = Math.max(s1.length, s2.length)
  return 1 - distance / maxLength
}

export interface ActiveCarrier {
  id: string
  name: string
  display_name: string
}

export interface MatchedCarrier extends ActiveCarrier {
  matchedWith: string
  similarity: number
}

/**
 * Find matching carriers from active carriers list
 * Returns carriers with similarity >= threshold (default 80%)
 */
export function findMatchingCarriers(
  niprCarriers: string[],
  activeCarriers: ActiveCarrier[],
  threshold: number = 0.8
): MatchedCarrier[] {
  const matches: MatchedCarrier[] = []

  for (const niprCarrier of niprCarriers) {
    for (const activeCarrier of activeCarriers) {
      // Check similarity against both name and display_name
      const nameSimilarity = calculateSimilarity(niprCarrier, activeCarrier.name)
      const displaySimilarity = calculateSimilarity(niprCarrier, activeCarrier.display_name)
      const maxSimilarity = Math.max(nameSimilarity, displaySimilarity)

      if (maxSimilarity >= threshold) {
        // Avoid duplicates - only add if not already matched
        if (!matches.find(m => m.id === activeCarrier.id)) {
          matches.push({
            ...activeCarrier,
            matchedWith: niprCarrier,
            similarity: maxSimilarity
          })
        }
      }
    }
  }

  // Sort by similarity (highest first)
  return matches.sort((a, b) => b.similarity - a.similarity)
}
