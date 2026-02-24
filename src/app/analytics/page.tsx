"use client"

import React from "react"
import UploadPolicyReportsModal from "@/components/modals/upload-policy-reports-modal"
import DownlineProductionChart, { DownlineProductionChartHandle } from "@/components/downline-production-chart"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SimpleSearchableSelect } from "@/components/ui/simple-searchable-select"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Info } from "lucide-react"
import { UpgradePrompt } from "@/components/upgrade-prompt"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/useApiFetch'
import { queryKeys } from '@/hooks/queryKeys'
import { QueryErrorDisplay } from '@/components/ui/query-error-display'
import { RefreshingIndicator } from '@/components/ui/refreshing-indicator'
import {
	CUMULATIVE_COLOR,
	AGE_RANGE_COLORS,
	CARRIER_COLORS,
	FALLBACK_COLORS,
	colorForLabel,
	carrierColorForLabel,
} from '@/lib/chart-colors'

// analytics_test_value: static data for the test analytics page
const analytics_test_value = {
  "meta": {
    "window": "allTime",
    "grain": "month",
    "asOf": "2025-10-30",
    "carriers": ["American Amicable", "Allstate", "Acme Life"],
    "includeWindowSlices12": false,
    "definitions": {
      "activeCountEom": "Policies active at month end",
      "inactiveCountEom": "Policies lapsed/terminated by month end",
      "submittedCount": "Policies submitted during the calendar month",
      "avgPremiumSubmitted": "Average written premium of policies submitted during the month (USD)",
      "persistencyFormula": "active / (active + inactive)"
    },
    "periodStart": "2024-11",
    "periodEnd": "2025-10"
  },

  "series": [
    {"period":"2024-11","carrier":"American Amicable","active":122,"inactive":30,"submitted":82,"avgPremiumSubmitted":92.0,"persistency":0.8026},
    {"period":"2024-12","carrier":"American Amicable","active":123,"inactive":31,"submitted":83,"avgPremiumSubmitted":92.6,"persistency":0.7987},
    {"period":"2025-01","carrier":"American Amicable","active":125,"inactive":31,"submitted":83,"avgPremiumSubmitted":93.2,"persistency":0.8013},
    {"period":"2025-02","carrier":"American Amicable","active":128,"inactive":32,"submitted":84,"avgPremiumSubmitted":93.8,"persistency":0.8000},
    {"period":"2025-03","carrier":"American Amicable","active":132,"inactive":33,"submitted":86,"avgPremiumSubmitted":94.4,"persistency":0.8000},
    {"period":"2025-04","carrier":"American Amicable","active":134,"inactive":34,"submitted":87,"avgPremiumSubmitted":95.0,"persistency":0.7976},
    {"period":"2025-05","carrier":"American Amicable","active":137,"inactive":35,"submitted":89,"avgPremiumSubmitted":95.6,"persistency":0.7966},
    {"period":"2025-06","carrier":"American Amicable","active":140,"inactive":35,"submitted":90,"avgPremiumSubmitted":96.2,"persistency":0.8000},
    {"period":"2025-07","carrier":"American Amicable","active":144,"inactive":36,"submitted":92,"avgPremiumSubmitted":96.8,"persistency":0.8000},
    {"period":"2025-08","carrier":"American Amicable","active":146,"inactive":37,"submitted":93,"avgPremiumSubmitted":97.4,"persistency":0.7986},
    {"period":"2025-09","carrier":"American Amicable","active":149,"inactive":37,"submitted":95,"avgPremiumSubmitted":98.0,"persistency":0.8016},
    {"period":"2025-10","carrier":"American Amicable","active":152,"inactive":38,"submitted":96,"avgPremiumSubmitted":98.6,"persistency":0.8000},

    {"period":"2024-11","carrier":"Allstate","active":202,"inactive":50,"submitted":118,"avgPremiumSubmitted":106.0,"persistency":0.8016},
    {"period":"2024-12","carrier":"Allstate","active":204,"inactive":51,"submitted":121,"avgPremiumSubmitted":106.6,"persistency":0.8000},
    {"period":"2025-01","carrier":"Allstate","active":206,"inactive":51,"submitted":122,"avgPremiumSubmitted":107.2,"persistency":0.8016},
    {"period":"2025-02","carrier":"Allstate","active":208,"inactive":52,"submitted":124,"avgPremiumSubmitted":107.8,"persistency":0.8000},
    {"period":"2025-03","carrier":"Allstate","active":210,"inactive":53,"submitted":126,"avgPremiumSubmitted":108.4,"persistency":0.7985},
    {"period":"2025-04","carrier":"Allstate","active":212,"inactive":54,"submitted":127,"avgPremiumSubmitted":109.0,"persistency":0.7970},
    {"period":"2025-05","carrier":"Allstate","active":214,"inactive":55,"submitted":129,"avgPremiumSubmitted":109.6,"persistency":0.7957},
    {"period":"2025-06","carrier":"Allstate","active":216,"inactive":55,"submitted":131,"avgPremiumSubmitted":110.2,"persistency":0.7963},
    {"period":"2025-07","carrier":"Allstate","active":218,"inactive":56,"submitted":133,"avgPremiumSubmitted":110.8,"persistency":0.7956},
    {"period":"2025-08","carrier":"Allstate","active":220,"inactive":57,"submitted":135,"avgPremiumSubmitted":111.4,"persistency":0.7948},
    {"period":"2025-09","carrier":"Allstate","active":222,"inactive":58,"submitted":137,"avgPremiumSubmitted":112.0,"persistency":0.7938},
    {"period":"2025-10","carrier":"Allstate","active":224,"inactive":58,"submitted":139,"avgPremiumSubmitted":112.6,"persistency":0.7946},

    {"period":"2024-11","carrier":"Acme Life","active":92,"inactive":25,"submitted":61,"avgPremiumSubmitted":82.0,"persistency":0.7863},
    {"period":"2024-12","carrier":"Acme Life","active":93,"inactive":26,"submitted":62,"avgPremiumSubmitted":82.6,"persistency":0.7815},
    {"period":"2025-01","carrier":"Acme Life","active":94,"inactive":26,"submitted":64,"avgPremiumSubmitted":83.2,"persistency":0.7832},
    {"period":"2025-02","carrier":"Acme Life","active":95,"inactive":27,"submitted":65,"avgPremiumSubmitted":83.8,"persistency":0.7787},
    {"period":"2025-03","carrier":"Acme Life","active":96,"inactive":27,"submitted":67,"avgPremiumSubmitted":84.4,"persistency":0.7805},
    {"period":"2025-04","carrier":"Acme Life","active":97,"inactive":28,"submitted":68,"avgPremiumSubmitted":85.0,"persistency":0.7760},
    {"period":"2025-05","carrier":"Acme Life","active":98,"inactive":29,"submitted":70,"avgPremiumSubmitted":85.6,"persistency":0.7714},
    {"period":"2025-06","carrier":"Acme Life","active":99,"inactive":29,"submitted":71,"avgPremiumSubmitted":86.2,"persistency":0.7733},
    {"period":"2025-07","carrier":"Acme Life","active":100,"inactive":30,"submitted":73,"avgPremiumSubmitted":86.8,"persistency":0.7692},
    {"period":"2025-08","carrier":"Acme Life","active":101,"inactive":31,"submitted":74,"avgPremiumSubmitted":87.4,"persistency":0.7652},
    {"period":"2025-09","carrier":"Acme Life","active":102,"inactive":31,"submitted":76,"avgPremiumSubmitted":88.0,"persistency":0.7672},
    {"period":"2025-10","carrier":"Acme Life","active":103,"inactive":32,"submitted":77,"avgPremiumSubmitted":88.6,"persistency":0.7630}
  ],

  "windowsByCarrier": {
    "American Amicable": {
      "3m":  { "active": 447,  "inactive": 112, "submitted": 284,  "avgPremiumSubmitted": 98.01, "persistency": 0.7996 },
      "6m":  { "active": 868,  "inactive": 218, "submitted": 555,  "avgPremiumSubmitted": 97.13, "persistency": 0.7993 },
      "9m":  { "active": 1262, "inactive": 317, "submitted": 812,  "avgPremiumSubmitted": 96.27, "persistency": 0.7992 },
      "allTime": { "active": 1632, "inactive": 409, "submitted": 1060, "avgPremiumSubmitted": 95.41, "persistency": 0.7996 }
    },
    "Allstate": {
      "3m":  { "active": 666,  "inactive": 173, "submitted": 411,  "avgPremiumSubmitted": 112.01, "persistency": 0.7938 },
      "6m":  { "active": 1314, "inactive": 339, "submitted": 804,  "avgPremiumSubmitted": 111.13, "persistency": 0.7949 },
      "9m":  { "active": 1944, "inactive": 498, "submitted": 1181, "avgPremiumSubmitted": 110.26, "persistency": 0.7961 },
      "allTime": { "active": 2556, "inactive": 650, "submitted": 1542, "avgPremiumSubmitted": 109.40, "persistency": 0.7973 }
    },
    "Acme Life": {
      "3m":  { "active": 306,  "inactive": 94,  "submitted": 227,  "avgPremiumSubmitted": 88.01, "persistency": 0.7650 },
      "6m":  { "active": 603,  "inactive": 182, "submitted": 441,  "avgPremiumSubmitted": 87.13, "persistency": 0.7682 },
      "9m":  { "active": 891,  "inactive": 264, "submitted": 641,  "avgPremiumSubmitted": 86.28, "persistency": 0.7714 },
      "allTime": { "active": 1170, "inactive": 341, "submitted": 828,  "avgPremiumSubmitted": 85.45, "persistency": 0.7743 }
    }
  },

  "totals": {
    "byCarrier": [
      {"window":"allTime","carrier":"American Amicable","active":1632,"inactive":409,"submitted":1060,"avgPremiumSubmitted":95.41,"persistency":0.7996},
      {"window":"allTime","carrier":"Allstate","active":2556,"inactive":650,"submitted":1542,"avgPremiumSubmitted":109.40,"persistency":0.7973},
      {"window":"allTime","carrier":"Acme Life","active":1170,"inactive":341,"submitted":828,"avgPremiumSubmitted":85.45,"persistency":0.7743}
    ],
    "all": {"window":"allTime","carrier":"ALL","active":5358,"inactive":1400,"submitted":3430,"avgPremiumSubmitted":99.30,"persistency":0.7928}
  },

  "breakdownsOverTime": {
    "byCarrier": {
      "American Amicable": {
        "status": {
          "3m":  {"Lapsed": 78, "Terminated": 22, "Pending": 12},
          "6m":  {"Lapsed": 153, "Terminated": 44, "Pending": 21},
          "9m":  {"Lapsed": 222, "Terminated": 63, "Pending": 32},
          "allTime": {"Lapsed": 286, "Terminated": 82, "Pending": 41}
        },
        "state": {
          "3m":  [
            {"state":"CA","active":210,"inactive":54,"submitted":135,"avgPremiumSubmitted":99.8},
            {"state":"TX","active":126,"inactive":35,"submitted":85,"avgPremiumSubmitted":93.9},
            {"state":"FL","active":111,"inactive":28,"submitted":64,"avgPremiumSubmitted":87.5}
          ],
          "6m":  [
            {"state":"CA","active":415,"inactive":106,"submitted":270,"avgPremiumSubmitted":99.5},
            {"state":"TX","active":249,"inactive":70,"submitted":170,"avgPremiumSubmitted":93.7},
            {"state":"FL","active":204,"inactive":52,"submitted":115,"avgPremiumSubmitted":87.3}
          ],
          "9m":  [
            {"state":"CA","active":603,"inactive":153,"submitted":400,"avgPremiumSubmitted":99.1},
            {"state":"TX","active":364,"inactive":99,"submitted":250,"avgPremiumSubmitted":93.6},
            {"state":"FL","active":295,"inactive":75,"submitted":162,"avgPremiumSubmitted":87.1}
          ],
          "allTime": [
            {"state":"CA","active":823,"inactive":200,"submitted":530,"avgPremiumSubmitted":100.76},
            {"state":"TX","active":494,"inactive":129,"submitted":318,"avgPremiumSubmitted":94.04},
            {"state":"FL","active":329,"inactive":80,"submitted":212,"avgPremiumSubmitted":88.29}
          ]
        },
        "ageBand": {
          "3m":  [
            {"ageBand":"18-29","active":82,"inactive":19,"submitted":54,"avgPremiumSubmitted":81.9},
            {"ageBand":"30-44","active":165,"inactive":40,"submitted":106,"avgPremiumSubmitted":91.3},
            {"ageBand":"45-64","active":153,"inactive":38,"submitted":98,"avgPremiumSubmitted":103.8},
            {"ageBand":"65+","active":47,"inactive":11,"submitted":26,"avgPremiumSubmitted":115.3}
          ],
          "6m":  [
            {"ageBand":"18-29","active":164,"inactive":38,"submitted":106,"avgPremiumSubmitted":81.7},
            {"ageBand":"30-44","active":329,"inactive":76,"submitted":213,"avgPremiumSubmitted":91.2},
            {"ageBand":"45-64","active":312,"inactive":72,"submitted":194,"avgPremiumSubmitted":103.7},
            {"ageBand":"65+","active":107,"inactive":24,"submitted":61,"avgPremiumSubmitted":115.2}
          ],
          "9m":  [
            {"ageBand":"18-29","active":248,"inactive":57,"submitted":160,"avgPremiumSubmitted":81.6},
            {"ageBand":"30-44","active":497,"inactive":115,"submitted":320,"avgPremiumSubmitted":91.2},
            {"ageBand":"45-64","active":471,"inactive":109,"submitted":295,"avgPremiumSubmitted":103.6},
            {"ageBand":"65+","active":161,"inactive":36,"submitted":98,"avgPremiumSubmitted":115.2}
          ],
          "allTime": [
            {"ageBand":"18-29","active":296,"inactive":72,"submitted":191,"avgPremiumSubmitted":81.57},
            {"ageBand":"30-44","active":592,"inactive":144,"submitted":382,"avgPremiumSubmitted":91.16},
            {"ageBand":"45-64","active":560,"inactive":136,"submitted":360,"avgPremiumSubmitted":103.64},
            {"ageBand":"65+","active":198,"inactive":47,"submitted":127,"avgPremiumSubmitted":115.15}
          ]
        }
      },

      "Allstate": {
        "status": {
          "3m":  {"Lapsed": 121, "Terminated": 35, "Pending": 17},
          "6m":  {"Lapsed": 237, "Terminated": 68, "Pending": 34},
          "9m":  {"Lapsed": 349, "Terminated": 100, "Pending": 49},
          "allTime": {"Lapsed": 455, "Terminated": 130, "Pending": 65}
        },
        "state": {
          "3m":  [
            {"state":"CA","active":634,"inactive":158,"submitted":391,"avgPremiumSubmitted":115.7},
            {"state":"TX","active":380,"inactive":93,"submitted":230,"avgPremiumSubmitted":108.2},
            {"state":"FL","active":259,"inactive":65,"submitted":150,"avgPremiumSubmitted":101.5}
          ],
          "6m":  [
            {"state":"CA","active":900,"inactive":231,"submitted":540,"avgPremiumSubmitted":115.5},
            {"state":"TX","active":540,"inactive":131,"submitted":335,"avgPremiumSubmitted":108.0},
            {"state":"FL","active":374,"inactive":100,"submitted":219,"avgPremiumSubmitted":101.2}
          ],
          "9m":  [
            {"state":"CA","active":1100,"inactive":282,"submitted":675,"avgPremiumSubmitted":115.4},
            {"state":"TX","active":660,"inactive":161,"submitted":420,"avgPremiumSubmitted":107.8},
            {"state":"FL","active":484,"inactive":127,"submitted":281,"avgPremiumSubmitted":100.9}
          ],
          "allTime": [
            {"state":"CA","active":1278,"inactive":325,"submitted":765,"avgPremiumSubmitted":115.44},
            {"state":"TX","active":767,"inactive":195,"submitted":467,"avgPremiumSubmitted":107.74},
            {"state":"FL","active":511,"inactive":130,"submitted":310,"avgPremiumSubmitted":101.15}
          ]
        },
        "ageBand": {
          "3m":  [
            {"ageBand":"18-29","active":215,"inactive":52,"submitted":132,"avgPremiumSubmitted":93.6},
            {"ageBand":"30-44","active":435,"inactive":108,"submitted":264,"avgPremiumSubmitted":104.5},
            {"ageBand":"45-64","active":411,"inactive":103,"submitted":247,"avgPremiumSubmitted":118.8},
            {"ageBand":"65+","active":145,"inactive":36,"submitted":83,"avgPremiumSubmitted":132.1}
          ],
          "6m":  [
            {"ageBand":"18-29","active":430,"inactive":104,"submitted":263,"avgPremiumSubmitted":93.5},
            {"ageBand":"30-44","active":870,"inactive":209,"submitted":527,"avgPremiumSubmitted":104.4},
            {"ageBand":"45-64","active":822,"inactive":206,"submitted":494,"avgPremiumSubmitted":118.7},
            {"ageBand":"65+","active":285,"inactive":67,"submitted":154,"avgPremiumSubmitted":131.9}
          ],
          "9m":  [
            {"ageBand":"18-29","active":665,"inactive":160,"submitted":400,"avgPremiumSubmitted":93.5},
            {"ageBand":"30-44","active":1340,"inactive":322,"submitted":812,"avgPremiumSubmitted":104.4},
            {"ageBand":"45-64","active":1268,"inactive":319,"submitted":765,"avgPremiumSubmitted":118.7},
            {"ageBand":"65+","active":450,"inactive":107,"submitted":240,"avgPremiumSubmitted":131.9}
          ],
          "allTime": [
            {"ageBand":"18-29","active":460,"inactive":119,"submitted":302,"avgPremiumSubmitted":93.45},
            {"ageBand":"30-44","active":920,"inactive":234,"submitted":561,"avgPremiumSubmitted":104.44},
            {"ageBand":"45-64","active":869,"inactive":221,"submitted":530,"avgPremiumSubmitted":118.73},
            {"ageBand":"65+","active":307,"inactive":76,"submitted":163,"avgPremiumSubmitted":131.93}
          ]
        }
      },

      "Acme Life": {
        "status": {
          "3m":  {"Lapsed": 66, "Terminated": 19, "Pending": 9},
          "6m":  {"Lapsed": 127, "Terminated": 36, "Pending": 19},
          "9m":  {"Lapsed": 185, "Terminated": 53, "Pending": 26},
          "allTime": {"Lapsed": 239, "Terminated": 68, "Pending": 34}
        },
        "state": {
          "3m":  [
            {"state":"CA","active":150,"inactive":43,"submitted":100,"avgPremiumSubmitted":90.3},
            {"state":"TX","active":89,"inactive":25,"submitted":60,"avgPremiumSubmitted":84.2},
            {"state":"FL","active":67,"inactive":19,"submitted":43,"avgPremiumSubmitted":77.5}
          ],
          "6m":  [
            {"state":"CA","active":299,"inactive":85,"submitted":201,"avgPremiumSubmitted":90.2},
            {"state":"TX","active":178,"inactive":49,"submitted":120,"avgPremiumSubmitted":84.2},
            {"state":"FL","active":134,"inactive":38,"submitted":80,"avgPremiumSubmitted":77.4}
          ],
          "9m":  [
            {"state":"CA","active":434,"inactive":123,"submitted":302,"avgPremiumSubmitted":90.2},
            {"state":"TX","active":259,"inactive":73,"submitted":182,"avgPremiumSubmitted":84.2},
            {"state":"FL","active":197,"inactive":55,"submitted":117,"avgPremiumSubmitted":77.4}
          ],
          "allTime": [
            {"state":"CA","active":569,"inactive":161,"submitted":402,"avgPremiumSubmitted":90.2},
            {"state":"TX","active":341,"inactive":97,"submitted":241,"avgPremiumSubmitted":84.19},
            {"state":"FL","active":228,"inactive":64,"submitted":158,"avgPremiumSubmitted":77.41}
          ]
        },
        "ageBand": {
          "3m":  [
            {"ageBand":"18-29","active":60,"inactive":18,"submitted":40,"avgPremiumSubmitted":73.1},
            {"ageBand":"30-44","active":121,"inactive":34,"submitted":78,"avgPremiumSubmitted":85.7},
            {"ageBand":"45-64","active":115,"inactive":32,"submitted":74,"avgPremiumSubmitted":96.4},
            {"ageBand":"65+","active":40,"inactive":10,"submitted":35,"avgPremiumSubmitted":103.1}
          ],
          "6m":  [
            {"ageBand":"18-29","active":120,"inactive":34,"submitted":80,"avgPremiumSubmitted":73.1},
            {"ageBand":"30-44","active":240,"inactive":68,"submitted":156,"avgPremiumSubmitted":85.6},
            {"ageBand":"45-64","active":230,"inactive":66,"submitted":148,"avgPremiumSubmitted":96.3},
            {"ageBand":"65+","active":80,"inactive":20,"submitted":70,"avgPremiumSubmitted":103.1}
          ],
          "9m":  [
            {"ageBand":"18-29","active":180,"inactive":52,"submitted":120,"avgPremiumSubmitted":73.1},
            {"ageBand":"30-44","active":360,"inactive":102,"submitted":234,"avgPremiumSubmitted":85.6},
            {"ageBand":"45-64","active":345,"inactive":98,"submitted":222,"avgPremiumSubmitted":96.3},
            {"ageBand":"65+","active":120,"inactive":33,"submitted":90,"avgPremiumSubmitted":103.1}
          ],
          "allTime": [
            {"ageBand":"18-29","active":205,"inactive":56,"submitted":122,"avgPremiumSubmitted":73.03},
            {"ageBand":"30-44","active":410,"inactive":116,"submitted":287,"avgPremiumSubmitted":85.61},
            {"ageBand":"45-64","active":387,"inactive":110,"submitted":272,"avgPremiumSubmitted":96.32},
            {"ageBand":"65+","active":136,"inactive":40,"submitted":120,"avgPremiumSubmitted":103.09}
          ]
        }
      }
    }
  }
} as const

function parsePeriodToIndex(period: string): number {
	const [y, m] = period.split("-").map(Number)
	return y * 12 + (m - 1)
}

function getLastNPeriods(series: ReadonlyArray<{ period: string }>, endPeriod: string, n: number | "all") {
	if (n === "all") return Array.from(new Set(series.map((s) => s.period)))
	const endIdx = parsePeriodToIndex(endPeriod)
	const unique = Array.from(new Set(series.map((s) => s.period)))
	const filtered = unique.filter((p) => endIdx - parsePeriodToIndex(p) < n)
	return filtered
}

function numberWithCommas(n: number) {
	return n.toLocaleString()
}

// Generate evenly spaced scale values
// Always starts at 0, ensures even spacing, and guarantees exactly 5 lines (0 + 4 more)
// Each line must be a whole number, except when max value is very small (like 1)
function generateScaleValues(minValue: number, maxValue: number, numLines: number = 5): number[] {
	// Always start at 0
	// We want exactly 5 lines: 0, line1, line2, line3, line4
	// So we need 4 intervals between 0 and max
	
	// Handle persistency (0-1 range) separately
	const isPersistency = minValue >= 0 && maxValue <= 1 && maxValue - minValue <= 1
	
	if (isPersistency) {
		// For persistency, always use 0, 0.25, 0.5, 0.75, 1.0 for 5 lines
		return [0, 0.25, 0.5, 0.75, 1.0]
	}
	
	// For other metrics, find the actual max value
	const actualMax = Math.max(0, maxValue)
	
	// If max is 0 or very small (less than 1), use decimal spacing
	if (actualMax < 1) {
		// Use evenly spaced decimal values with 4 intervals
		const scale = Math.max(actualMax, 0.25) // Ensure at least 0.25 for visibility
		const step = scale / 4 // 4 intervals between 0 and scale
		return [0, step, step * 2, step * 3, scale]
	}
	
	// For values >= 1, we need whole numbers
	// Round up actualMax to the next whole number
	const ceilMax = Math.ceil(actualMax)
	
	// Custom rule 1: If max value is under 5, use 4, 3, 2, 1, 0 (step = 1, max = 4)
	if (ceilMax < 5) {
		return [0, 1, 2, 3, 4]
	}
	
	// Custom rule 2: If max value tops at 9, go up to 20
	if (ceilMax <= 9) {
		return [0, 5, 10, 15, 20]
	}
	
	// Custom rule 3: Check if within 30 of next nice round number (100, 200, 300, 1000, 2000, etc.)
	// Generate list of nice round numbers to check (sorted ascending)
	const niceRoundNumbers: number[] = []
	for (let magnitude = 100; magnitude <= 1000000; magnitude *= 10) {
		niceRoundNumbers.push(magnitude)
		niceRoundNumbers.push(magnitude * 2)
		niceRoundNumbers.push(magnitude * 3)
		niceRoundNumbers.push(magnitude * 5)
	}
	niceRoundNumbers.sort((a, b) => a - b)
	
	// Find the next nice round number that's >= ceilMax
	// Then check if ceilMax is within 30 of it
	for (const niceNum of niceRoundNumbers) {
		if (niceNum >= ceilMax) {
			// Check if ceilMax is within 30 of this nice number
			if (niceNum - ceilMax <= 30) {
				// Use this nice round number as the max
				// We need to find a step size that's a multiple of 5 and gives us this max
				// max = 4 * step, so step = max / 4
				// But step must be a multiple of 5, so max must be a multiple of 20
				// If niceNum is not a multiple of 20, round it up to the next multiple of 20
				const roundedMax = Math.ceil(niceNum / 20) * 20
				const step = roundedMax / 4
				
				const values: number[] = []
				for (let i = 0; i < numLines; i++) {
					values.push(Math.round(i * step))
				}
				values[values.length - 1] = roundedMax
				return values
			} else {
				// If we've passed the range, no need to check further
				break
			}
		}
	}
	
	// Default behavior: We want exactly 4 intervals, so we need to find a max that's divisible by 4
	// The max should be a multiple of 4 for even spacing: max = 4 * step
	// Additionally, we want all values to end in 0 or 5, so step must be a multiple of 5
	// This means max will be a multiple of 20 (4 * 5 = 20)
	
	// Find the smallest multiple of 20 that's >= ceilMax (this is our baseline)
	const baselineMax = Math.ceil(ceilMax / 20) * 20
	
	// Try to find a step size that's a multiple of 5
	// This ensures all values (step, 2*step, 3*step, 4*step) end in 0 or 5
	// Step sizes that are multiples of 5: 5, 10, 15, 20, 25, 50, 100, 200, 500, etc.
	const niceSteps = [5, 10, 15, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
	
	let roundedMax = baselineMax
	
	// Find the best step size that gives us a reasonable max
	// Prefer smaller steps when possible, but use nice round numbers ending in 0 or 5
	for (const step of niceSteps) {
		// With 4 intervals, max would be 4 * step
		const candidateMax = 4 * step
		
		// If this max is >= ceilMax and not too much larger than baseline, use it
		if (candidateMax >= ceilMax && candidateMax <= baselineMax * 1.5) {
			// Use the smallest candidate that meets our criteria
			if (candidateMax < roundedMax) {
				roundedMax = candidateMax
			}
			// If it's exactly baselineMax or smaller, that's perfect, we can stop
			if (candidateMax <= baselineMax) {
				break
			}
		}
	}
	
	// Calculate the step size for 4 intervals
	const step = roundedMax / 4
	
	// Generate exactly 5 evenly spaced values: 0, step, 2*step, 3*step, 4*step (which equals roundedMax)
	// Since step is a multiple of 5, all values will end in 0 or 5
	const values: number[] = []
	for (let i = 0; i < numLines; i++) {
		const value = i * step
		// Round to whole number (should already be whole, but just in case)
		values.push(Math.round(value))
	}
	
	// Ensure the last value is exactly roundedMax
	values[values.length - 1] = roundedMax
	
	return values
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = (angleDeg - 90) * (Math.PI / 180)
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
	// Handle full circle (360 degrees) as a special case
	const angleDiff = endAngle - startAngle
	if (Math.abs(angleDiff - 360) < 0.01) {
		// Full circle - draw as a complete circle path
		// For a full circle, we still need the center-to-edge lines for the pie slice shape,
		// but we'll use the fill color for stroke to hide the center line
		const start = polarToCartesian(cx, cy, r, startAngle)
		// Use two 180-degree arcs to complete the circle smoothly
		const midPoint = polarToCartesian(cx, cy, r, startAngle + 180)
		return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${r} ${r} 0 1 1 ${midPoint.x} ${midPoint.y}`, `A ${r} ${r} 0 1 1 ${start.x} ${start.y}`, "Z"].join(" ")
	}
	const start = polarToCartesian(cx, cy, r, endAngle)
	const end = polarToCartesian(cx, cy, r, startAngle)
	const largeArcFlag = angleDiff <= 180 ? 0 : 1
	return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`, "Z"].join(" ")
}

function describeDonutArc(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number) {
	const outerStart = polarToCartesian(cx, cy, outerR, endAngle)
	const outerEnd = polarToCartesian(cx, cy, outerR, startAngle)
	const innerStart = polarToCartesian(cx, cy, innerR, startAngle)
	const innerEnd = polarToCartesian(cx, cy, innerR, endAngle)
	const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
	return [
		`M ${outerStart.x} ${outerStart.y}`,
		`A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
		`L ${innerStart.x} ${innerStart.y}`,
		`A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
		"Z"
	].join(" ")
}

// Helper function to create smooth curve path from points using cubic Bezier curves
function createSmoothCurvePath(points: Array<{ x: number; y: number }>): string {
	if (points.length === 0) return ""
	if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
	if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

	let path = `M ${points[0].x} ${points[0].y}`

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)]
		const p1 = points[i]
		const p2 = points[i + 1]
		const p3 = points[Math.min(points.length - 1, i + 2)]

		// Calculate control points for smooth curve
		const cp1x = p1.x + (p2.x - p0.x) / 6
		const cp1y = p1.y + (p2.y - p0.y) / 6
		const cp2x = p2.x - (p3.x - p1.x) / 6
		const cp2y = p2.y - (p3.y - p1.y) / 6

		// Use cubic Bezier curve
		path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
	}

	return path
}

type AnalyticsTestValue = typeof analytics_test_value

export default function AnalyticsTestPage() {
	const [groupBy, setGroupBy] = React.useState("carrier")
	const [trendMetric, setTrendMetric] = React.useState<"persistency" | "placement" | "submitted" | "active" | "avgprem" | "all">("persistency")
	const [timeWindow, setTimeWindow] = React.useState<"3" | "6" | "9" | "all">("all")
	const [carrierFilter, setCarrierFilter] = React.useState<string>("ALL")
	const [selectedCarrier, setSelectedCarrier] = React.useState<string | null>(null)
	const [hoverInfo, setHoverInfo] = React.useState<null | { x: number; y: number; label: string; submitted: number; sharePct: number; persistencyPct: number; active: number }>(null)
	const [hoverStatusInfo, setHoverStatusInfo] = React.useState<null | { x: number; y: number; status: string; count: number; pct: number }>(null)
	const [hoverBreakdownInfo, setHoverBreakdownInfo] = React.useState<null | { x: number; y: number; label: string; value: number; pct: number; groupedStates?: { label: string; value: number; pct: number }[]; total?: number }>(null)
	const [hoverPersistencyInfo, setHoverPersistencyInfo] = React.useState<null | { x: number; y: number; label: string; count: number; pct: number }>(null)
	const [hoverPlacementInfo, setHoverPlacementInfo] = React.useState<null | { x: number; y: number; label: string; count: number; pct: number }>(null)
	const [hoverTrendInfo, setHoverTrendInfo] = React.useState<null | { x: number; y: number; period: string; value: number; carrier?: string; submitted?: number; active?: number; persistency?: number; placement?: number; avgPremium?: number }>(null)
	const [showPersistencyTooltip, setShowPersistencyTooltip] = React.useState(false)
	const [showPlacementTooltip, setShowPlacementTooltip] = React.useState(false)
	const [visibleCarriers, setVisibleCarriers] = React.useState<Set<string>>(new Set())
	const [draggedCarrier, setDraggedCarrier] = React.useState<string | null>(null)
	const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false)
	const [downlineTitle, setDownlineTitle] = React.useState<string | null>(null)
	const [downlineBreadcrumbInfo, setDownlineBreadcrumbInfo] = React.useState<{ currentAgentName: string; breadcrumbs: Array<{ agentId: string; agentName: string }>; isAtRoot: boolean } | null>(null)
	const downlineChartRef = React.useRef<DownlineProductionChartHandle>(null)
	const [selectedAgentId, setSelectedAgentId] = React.useState<string>("")
	const [viewMode, setViewMode] = React.useState<'just_me' | 'downlines'>(() => {
		if (typeof window !== 'undefined') {
			return (localStorage.getItem('analytics_view_mode') as 'just_me' | 'downlines') || 'downlines'
		}
		return 'downlines'
	})

	// Save view mode to localStorage
	React.useEffect(() => {
		localStorage.setItem('analytics_view_mode', viewMode)
	}, [viewMode])

	const queryClient = useQueryClient()
	const { user } = useAuth()

	// Get user data from AuthProvider (already loaded on app mount)
	const originalUserId = user?.id || null
	const subscriptionTier = user?.subscriptionTier || 'free'
	const userRole = user?.role || null
	const hasAnalyticsAccess = subscriptionTier === 'pro' || subscriptionTier === 'expert'

	// 1. Main analytics fetch - Get analytics data only (user data comes from AuthProvider)
	const { data: mainAnalyticsData, isPending: isMainAnalyticsLoading, isFetching: isMainAnalyticsFetching, error: mainAnalyticsError } = useQuery({
		queryKey: queryKeys.analyticsData({ view: 'initial' }),
		queryFn: async () => {
			if (!user?.id) throw new Error('No authenticated user')

			// Call the API route instead of direct Supabase RPC
			const analyticsResponse = await fetch('/api/analytics/split-view', {
				credentials: 'include',
			})
			if (!analyticsResponse.ok) {
				const errorData = await analyticsResponse.json().catch(() => ({}))
				throw new Error(errorData.error || 'Failed to fetch analytics')
			}
			const rpcData = await analyticsResponse.json()
			if (!rpcData) throw new Error('No analytics data returned')

			return {
				analyticsFullData: rpcData as {yourDeals: AnalyticsTestValue | null, downline: AnalyticsTestValue | null},
			}
		},
		enabled: !!user?.id && hasAnalyticsAccess,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	})

	// Derive userId for analytics (selected agent or current user)
	const userId = selectedAgentId || originalUserId

	// 2. Fetch all agents for the search dropdown
	const { data: agentsData } = useApiFetch<{ allAgents?: Array<{ id: string; name: string }> }>(
		queryKeys.agents,
		'/api/agents?view=table&page=1&limit=1',
		{
			enabled: !!originalUserId && hasAnalyticsAccess,
			staleTime: 5 * 60 * 1000, // 5 minutes
		}
	)

	// Filter agents list - exclude current user (pure transformation, no side effects)
	const allAgents = React.useMemo(() => {
		if (!agentsData?.allAgents) return []
		if (originalUserId) {
			// Filter out the current user from the agents list
			return agentsData.allAgents.filter((agent: { id: string }) => agent.id !== originalUserId)
		}
		return agentsData.allAgents
	}, [agentsData?.allAgents, originalUserId])

	// 3. Fetch analytics when selected agent changes
	const targetUserId = selectedAgentId || originalUserId
	const { data: selectedAgentAnalytics, isPending: isSelectedAgentLoading } = useQuery({
		queryKey: queryKeys.analyticsData({ agentId: targetUserId }),
		queryFn: async () => {
			const url = targetUserId
				? `/api/analytics/split-view?agent_id=${targetUserId}`
				: '/api/analytics/split-view'
			const response = await fetch(url, { credentials: 'include' })
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(errorData.error || 'Failed to fetch analytics')
			}
			return response.json() as Promise<{yourDeals: AnalyticsTestValue | null, downline: AnalyticsTestValue | null}>
		},
		enabled: !!targetUserId && hasAnalyticsAccess,
		staleTime: 5 * 60 * 1000, // 5 minutes
	})

	// Compute the active analytics data based on viewMode and selectedAgentAnalytics
	const _analyticsFullData = selectedAgentAnalytics || mainAnalyticsData?.analyticsFullData || null
	const _analyticsData = React.useMemo(() => {
		if (!_analyticsFullData) return null
		if (viewMode === 'just_me') {
			return _analyticsFullData.yourDeals as AnalyticsTestValue
		} else {
			return _analyticsFullData.downline as AnalyticsTestValue
		}
	}, [viewMode, _analyticsFullData])

	const isLoading = isMainAnalyticsLoading || isSelectedAgentLoading || !_analyticsData
	const isRefreshing = isMainAnalyticsFetching && !isMainAnalyticsLoading
	const analyticsData = _analyticsData as AnalyticsTestValue | null

	const carriers = React.useMemo(() => ["ALL", ...(_analyticsData?.meta.carriers ?? [])], [_analyticsData])

	// Don't initialize visible carriers - by default, only show cumulative (all carriers hidden)
	// Users can click on carriers in the legend to show/hide them

	const n: number | "all" = timeWindow === "all" ? "all" : Number(timeWindow)
	const periods = React.useMemo(() => {
		if (!_analyticsData) return [] as string[]
		return getLastNPeriods(_analyticsData.series, _analyticsData.meta.periodEnd, n)
	}, [_analyticsData, timeWindow])

	// Aggregations per carrier for current window
	const byCarrierAgg = React.useMemo(() => {
		const agg: Record<string, { submitted: number; active: number; inactive: number }> = {}
		for (const c of (_analyticsData?.meta.carriers ?? [])) agg[c] = { submitted: 0, active: 0, inactive: 0 }
		for (const row of (_analyticsData?.series ?? [])) {
			if (!periods.includes(row.period)) continue
			if (carrierFilter !== "ALL" && row.carrier !== carrierFilter) continue
			agg[row.carrier].submitted += row.submitted
			agg[row.carrier].active += row.active
			agg[row.carrier].inactive += row.inactive
		}
		return agg
	}, [periods, carrierFilter])

	const totalSubmitted = React.useMemo(() => Object.values(byCarrierAgg).reduce((a, s) => a + s.submitted, 0), [byCarrierAgg])

	// Calculate top stats based on selected carrier and time window
	const topStats = React.useMemo(() => {
		let totalActive = 0
		let totalInactive = 0
		let totalSubmittedValue = 0
		let totalPlaced = 0
		let totalNotPlaced = 0

		for (const row of (_analyticsData?.series ?? [])) {
			if (!periods.includes(row.period)) continue
			if (carrierFilter !== "ALL" && row.carrier !== carrierFilter) continue
			totalActive += row.active || 0
			totalInactive += row.inactive || 0
			totalSubmittedValue += row.submitted || 0
		}

		// Calculate placement from windowsByCarrier data
		const windowKey = timeWindow === "all" ? "allTime" : `${timeWindow}m` as "3m" | "6m" | "9m" | "allTime"
		const windowsByCarrier = _analyticsData?.windowsByCarrier
		
		if (carrierFilter === "ALL") {
			// Sum across all carriers
			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				if (!windowsByCarrier || !(carrier in windowsByCarrier)) continue
				const carrierData = windowsByCarrier[carrier as keyof typeof windowsByCarrier]
				if (!carrierData) continue
				const windowData = carrierData[windowKey]
				if (!windowData) continue
				totalPlaced += (windowData as any).placed || 0
				totalNotPlaced += (windowData as any).notPlaced || 0
			}
		} else {
			// Single carrier
			if (windowsByCarrier && carrierFilter in windowsByCarrier) {
				const carrierData = windowsByCarrier[carrierFilter as keyof typeof windowsByCarrier]
				if (carrierData) {
					const windowData = carrierData[windowKey]
					if (windowData) {
						totalPlaced = (windowData as any).placed || 0
						totalNotPlaced = (windowData as any).notPlaced || 0
					}
				}
			}
		}

		const persistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
		const placement = totalPlaced + totalNotPlaced > 0 ? totalPlaced / (totalPlaced + totalNotPlaced) : 0

		return {
			persistency: persistency,
			placement: placement,
			submitted: totalSubmittedValue,
			active: totalActive,
		}
	}, [periods, carrierFilter, timeWindow, _analyticsData])

// Chart colors are imported from @/lib/chart-colors

// Map old age bands to new standardized age ranges with proportional distribution
function mapAgeBandToStandardRanges(oldAgeBand: string): Array<{ range: string; proportion: number }> {
	const normalized = oldAgeBand.trim()
	
	// Direct mappings
	if (normalized === "18-29" || normalized === "18-30") {
		return [{ range: "18-30", proportion: 1.0 }]
	}
	
	// 30-44: 30 -> 18-30 (1/15), 31-40 -> 31-40 (10/15), 41-44 -> 41-50 (4/15)
	if (normalized === "30-44") {
		return [
			{ range: "18-30", proportion: 1 / 15 },
			{ range: "31-40", proportion: 10 / 15 },
			{ range: "41-50", proportion: 4 / 15 },
		]
	}
	
	// 45-64: 45-50 -> 41-50 (6/20), 51-60 -> 51-60 (10/20), 61-64 -> 61-70 (4/20)
	if (normalized === "45-64") {
		return [
			{ range: "41-50", proportion: 6 / 20 },
			{ range: "51-60", proportion: 10 / 20 },
			{ range: "61-70", proportion: 4 / 20 },
		]
	}
	
	// 65+: Assuming 65-85 range, 65-70 -> 61-70 (6/21), 71-85 -> 71+ (15/21)
	if (normalized === "65+" || normalized.startsWith("65")) {
		return [
			{ range: "61-70", proportion: 6 / 21 },
			{ range: "71+", proportion: 15 / 21 },
		]
	}
	
	// For any other format, try to parse and map
	// Handle ranges like "31-40", "41-50", etc. that might already be in the new format
	const newRanges = ["18-30", "31-40", "41-50", "51-60", "61-70", "71+"]
	for (const range of newRanges) {
		if (normalized === range || normalized.includes(range)) {
			return [{ range, proportion: 1.0 }]
		}
	}
	
	// Fallback: try to extract numbers and map
	const numbers = normalized.match(/\d+/g)
	if (numbers && numbers.length >= 1) {
		const startAge = parseInt(numbers[0])
		if (startAge >= 18 && startAge <= 30) return [{ range: "18-30", proportion: 1.0 }]
		if (startAge >= 31 && startAge <= 40) return [{ range: "31-40", proportion: 1.0 }]
		if (startAge >= 41 && startAge <= 50) return [{ range: "41-50", proportion: 1.0 }]
		if (startAge >= 51 && startAge <= 60) return [{ range: "51-60", proportion: 1.0 }]
		if (startAge >= 61 && startAge <= 70) return [{ range: "61-70", proportion: 1.0 }]
		if (startAge >= 71) return [{ range: "71+", proportion: 1.0 }]
	}
	
	// Unknown age band - return empty array
	return []
}

function displayStateLabel(stateCode: string): string {
    return stateCode === "UNK" ? "Unknown" : stateCode
}

function getTimeframeLabel(timeWindow: "3" | "6" | "9" | "all"): string {
    switch (timeWindow) {
        case "3": return "3 Months"
        case "6": return "6 Months"
        case "9": return "9 Months"
        case "all": return "All Time"
    }
}

	const wedges = React.useMemo(() => {
		let cursor = 0
    return (_analyticsData?.meta.carriers ?? [])
            .map((label) => ({
                label,
                value: byCarrierAgg[label].submitted,
                color: carrierColorForLabel(label),
            }))
			.filter((w) => w.value > 0)
			.map((w) => {
				const pct = totalSubmitted > 0 ? w.value / totalSubmitted : 0
				const ang = pct * 360
				const piece = { ...w, start: cursor, end: cursor + ang, pct: Math.round(pct * 1000) / 10 }
				cursor += ang
				return piece
			})
	}, [byCarrierAgg, totalSubmitted, _analyticsData])

	// Determine if we should show detail view
	const detailCarrier = React.useMemo(() => {
		if (selectedCarrier) return selectedCarrier
		if (carrierFilter !== "ALL" && groupBy === "carrier") return carrierFilter
		return null
	}, [selectedCarrier, carrierFilter, groupBy])

	// Helper to get window key
	const windowKey = React.useMemo(() => timeWindow === "all" ? "allTime" : `${timeWindow}m` as "3m" | "6m" | "9m" | "allTime", [timeWindow])

	// Status breakdown for detail view (when groupBy === "carrier")
	const statusBreakdown = React.useMemo(() => {
		if (!detailCarrier || groupBy !== "carrier") return null
		const byCarrier = _analyticsData?.breakdownsOverTime?.byCarrier
		if (!byCarrier || !(detailCarrier in byCarrier)) return null
		const carrierData = byCarrier[detailCarrier as keyof typeof byCarrier]?.status?.[windowKey]
		if (!carrierData) return null

		// Use large palette with deterministic mapping so we have many distinct colors
		const colorForStatus = (status: string) => colorForLabel(status)

		// Only include statuses that exist in the breakdownsStatusOverTime data for this carrier
		const entries: { status: string; count: number; color: string }[] = []

		// Add statuses from breakdownsStatusOverTime - only if they exist as keys in carrierData
		Object.keys(carrierData).forEach((status) => {
			const count = carrierData[status as keyof typeof carrierData] as number | undefined
			if (count !== undefined && count >= 0) {
				entries.push({
					status,
					count,
					color: colorForStatus(status),
				})
			}
		})

		const total = entries.reduce((sum, e) => sum + e.count, 0)

		// Filter entries with count > 0 for donut chart
		const entriesWithData = entries.filter(e => e.count > 0)

		let cursor = 0
		const donutWedges = entriesWithData.map((e) => {
			const pct = total > 0 ? e.count / total : 0
			const ang = pct * 360
			const piece = {
				...e,
				start: cursor,
				end: cursor + ang,
				pct: Math.round(pct * 1000) / 10,
			}
			cursor += ang
			return piece
		})

		// Calculate percentages for all entries for legend
		const allEntries = entries.map(e => ({
			...e,
			pct: total > 0 ? Math.round((e.count / total) * 1000) / 10 : 0,
		}))

		return { wedges: donutWedges, legendEntries: allEntries, total }
	}, [detailCarrier, timeWindow, windowKey, groupBy])

	// State breakdown for detail view (when groupBy === "state")
	const stateBreakdown = React.useMemo(() => {
		if (groupBy !== "state") return null

        const stateColors: Record<string, string> = {
            CA: colorForLabel("CA"),
            TX: colorForLabel("TX"),
            FL: colorForLabel("FL"),
            NY: colorForLabel("NY"),
            AZ: colorForLabel("AZ"),
        }

		const entries: { label: string; value: number; color: string }[] = []

		if (carrierFilter === "ALL") {
			// Sum across all carriers
			const stateTotals: Record<string, { submitted: number }> = {}

			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				const byCarrier = _analyticsData?.breakdownsOverTime?.byCarrier
				if (!byCarrier || !(carrier in byCarrier)) continue
				const carrierData = byCarrier[carrier as keyof typeof byCarrier]
				if (!carrierData) continue
				const stateData = carrierData.state?.[windowKey]
				if (!stateData) continue

				for (const stateEntry of stateData) {
					if (!stateTotals[stateEntry.state]) {
						stateTotals[stateEntry.state] = { submitted: 0 }
					}
					stateTotals[stateEntry.state].submitted += stateEntry.submitted
				}
			}

            Object.entries(stateTotals).forEach(([state, data]) => {
				if (data.submitted > 0) {
                    const label = displayStateLabel(state)
					entries.push({
                        label,
						value: data.submitted,
                        color: stateColors[label] || colorForLabel(label),
					})
				}
			})
		} else {
			// Single carrier
			const byCarrier = _analyticsData?.breakdownsOverTime?.byCarrier
			if (!byCarrier || !(carrierFilter in byCarrier)) return { wedges: [], total: 0, isFullyUnknown: true, groupedStates: {} }
			const carrierData = byCarrier[carrierFilter as keyof typeof byCarrier]
			if (!carrierData) return { wedges: [], total: 0, isFullyUnknown: true, groupedStates: {} }
			const stateData = carrierData.state?.[windowKey]
			if (!stateData) return { wedges: [], total: 0, isFullyUnknown: true, groupedStates: {} }

            stateData.forEach((entry: { state: string; submitted: number }) => {
				if (entry.submitted > 0) {
                    const label = displayStateLabel(entry.state)
					entries.push({
                        label,
						value: entry.submitted,
                        color: stateColors[label] || colorForLabel(label),
					})
				}
			})
		}

		const total = entries.reduce((sum, e) => sum + e.value, 0)

		// Check if all entries are "Unknown" or if there's no valid data
		const isFullyUnknown = entries.length === 0 || (entries.length > 0 && entries.every(e => e.label === "Unknown"))

		if (isFullyUnknown) {
			return { wedges: [], total, isFullyUnknown: true, groupedStates: {} }
		}

		// Separate states with percentage < 1.5% into "Other" group
		// Note: "Unknown" states are kept separate and not grouped into "Other"
		const mainEntries: { label: string; value: number; color: string }[] = []
		const otherEntries: { label: string; value: number; pct: number }[] = []

		entries.forEach((e) => {
			const pct = total > 0 ? (e.value / total) * 100 : 0
			// Group states under 1.5% into "Other", but keep "Unknown" states separate
			if (pct < 1.5 && e.label !== "Unknown") {
				otherEntries.push({
					label: e.label,
					value: e.value,
					pct: Math.round(pct * 1000) / 10,
				})
			} else {
				mainEntries.push(e)
			}
		})

		// Sort other entries by percentage (largest to smallest)
		otherEntries.sort((a, b) => b.pct - a.pct)

		// Create grouped states data for the Other slice
		const groupedStates: Record<string, { label: string; value: number; pct: number }[]> = {}
		
		// Add Other entry if there are any states to group
		if (otherEntries.length > 0) {
			const otherTotal = otherEntries.reduce((sum, e) => sum + e.value, 0)
			groupedStates["Other"] = otherEntries
			mainEntries.push({
				label: "Other",
				value: otherTotal,
				color: colorForLabel("Other"),
			})
		}

		// Sort main entries by value (largest first) for better visualization
		mainEntries.sort((a, b) => b.value - a.value)

		let cursor = 0
		const wedges = mainEntries.map((e) => {
			const pct = total > 0 ? e.value / total : 0
			const ang = pct * 360
			const piece = {
				...e,
				start: cursor,
				end: cursor + ang,
				pct: Math.round(pct * 1000) / 10,
			}
			cursor += ang
			return piece
		})

		return { wedges, total, isFullyUnknown: false, groupedStates }
	}, [carrierFilter, windowKey, groupBy, _analyticsData])

	// Age breakdown for detail view (when groupBy === "age")
	const ageBreakdown = React.useMemo(() => {
		if (groupBy !== "age") return null

		// Initialize standardized age ranges with 0 values
		const standardizedRanges: Record<string, number> = {
			"18-30": 0,
			"31-40": 0,
			"41-50": 0,
			"51-60": 0,
			"61-70": 0,
			"71+": 0,
		}

		if (carrierFilter === "ALL") {
			// Sum across all carriers
			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				const byCarrier = _analyticsData?.breakdownsOverTime?.byCarrier
				if (!byCarrier || !(carrier in byCarrier)) continue
				const carrierData = byCarrier[carrier as keyof typeof byCarrier]
				if (!carrierData) continue
				const ageData = carrierData.ageBand?.[windowKey]
				if (!ageData) continue

				for (const ageEntry of ageData) {
					// Map old age band to new standardized ranges
					const mappings = mapAgeBandToStandardRanges(ageEntry.ageBand)
					for (const mapping of mappings) {
						if (standardizedRanges[mapping.range] !== undefined) {
							standardizedRanges[mapping.range] += ageEntry.submitted * mapping.proportion
						}
					}
				}
			}
		} else {
			// Single carrier
			const byCarrier = _analyticsData?.breakdownsOverTime?.byCarrier
			if (!byCarrier || !(carrierFilter in byCarrier)) return { wedges: [], total: 0, isFullyUnknown: true }
			const carrierData = byCarrier[carrierFilter as keyof typeof byCarrier]
			if (!carrierData) return { wedges: [], total: 0, isFullyUnknown: true }
			const ageData = carrierData.ageBand?.[windowKey]
			if (!ageData) return { wedges: [], total: 0, isFullyUnknown: true }

			for (const entry of ageData) {
				// Map old age band to new standardized ranges
				const mappings = mapAgeBandToStandardRanges(entry.ageBand)
				for (const mapping of mappings) {
					if (standardizedRanges[mapping.range] !== undefined) {
						standardizedRanges[mapping.range] += entry.submitted * mapping.proportion
					}
				}
			}
		}

		// Create entries only for ranges with data > 0
		const entries: { label: string; value: number; color: string }[] = []
		for (const [range, value] of Object.entries(standardizedRanges)) {
			if (value > 0) {
				entries.push({
					label: range,
					value: Math.round(value * 100) / 100, // Round to 2 decimal places
					color: AGE_RANGE_COLORS[range] || colorForLabel(range),
				})
			}
		}

		const total = entries.reduce((sum, e) => sum + e.value, 0)

		// Check if all entries are "Unknown" or if there's no valid age data
		const isFullyUnknown = entries.length === 0 || entries.every(e => e.label === "Unknown" || e.label === "UNK")

		if (isFullyUnknown) {
			return { wedges: [], total, isFullyUnknown: true }
		}

		let cursor = 0
		const wedges = entries.map((e) => {
			const pct = total > 0 ? e.value / total : 0
			const ang = pct * 360
			const piece = {
				...e,
				start: cursor,
				end: cursor + ang,
				pct: Math.round(pct * 1000) / 10,
			}
			cursor += ang
			return piece
		})

		return { wedges, total, isFullyUnknown: false }
	}, [carrierFilter, windowKey, groupBy, _analyticsData])

	// Persistency breakdown for detail view (when groupBy === "persistency")
	const persistencyBreakdown = React.useMemo(() => {
		if (groupBy !== "persistency") return null

		const persistencyColors: Record<string, string> = {
			"Active": "#10b981",  // Green
			"Inactive": "#ef4444", // Red
		}

		let active = 0
		let inactive = 0

		if (carrierFilter === "ALL") {
			// Sum across all carriers
			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				const windowsByCarrier = _analyticsData?.windowsByCarrier
				if (!windowsByCarrier || !(carrier in windowsByCarrier)) continue
				const carrierData = windowsByCarrier[carrier as keyof typeof windowsByCarrier]
				if (!carrierData) continue
				const windowData = carrierData[windowKey]
				if (!windowData) continue
				active += windowData.active || 0
				inactive += windowData.inactive || 0
			}
		} else {
			// Single carrier
			const windowsByCarrier = _analyticsData?.windowsByCarrier
			if (!windowsByCarrier || !(carrierFilter in windowsByCarrier)) return null
			const carrierData = windowsByCarrier[carrierFilter as keyof typeof windowsByCarrier]
			if (!carrierData) return null
			const windowData = carrierData[windowKey]
			if (!windowData) return null
			active = windowData.active || 0
			inactive = windowData.inactive || 0
		}

		const entries: { label: string; count: number; color: string }[] = [
			{ label: "Active", count: active, color: persistencyColors["Active"] },
			{ label: "Inactive", count: inactive, color: persistencyColors["Inactive"] },
		]

		const total = active + inactive

		// Always include both entries, even if one has count 0, to ensure pie chart renders correctly
		let cursor = 0
		const wedges = entries.map((e) => {
			const pct = total > 0 ? e.count / total : 0
			const ang = pct * 360
			const piece = {
				...e,
				start: cursor,
				end: cursor + ang,
				pct: Math.round(pct * 1000) / 10,
			}
			cursor += ang
			return piece
		}).filter(e => e.count > 0) // Filter after calculating angles to ensure proper rendering

		return { wedges, total, active, inactive }
	}, [carrierFilter, windowKey, groupBy])

	// Placement breakdown for detail view (when groupBy === "placement")
	const placementBreakdown = React.useMemo(() => {
		if (groupBy !== "placement") return null

		const placementColors: Record<string, string> = {
			"Placed": "#10b981",  // Green
			"Not Placed": "#ef4444", // Red
		}

		let placed = 0
		let notPlaced = 0

		if (carrierFilter === "ALL") {
			// Sum across all carriers
			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				const windowsByCarrier = _analyticsData?.windowsByCarrier
				if (!windowsByCarrier || !(carrier in windowsByCarrier)) continue
				const carrierData = windowsByCarrier[carrier as keyof typeof windowsByCarrier]
				if (!carrierData) continue
				const windowData = carrierData[windowKey]
				if (!windowData) continue
				placed += (windowData as any).placed || 0
				notPlaced += (windowData as any).notPlaced || 0
			}
		} else {
			// Single carrier
			const windowsByCarrier = _analyticsData?.windowsByCarrier
			if (!windowsByCarrier || !(carrierFilter in windowsByCarrier)) return null
			const carrierData = windowsByCarrier[carrierFilter as keyof typeof windowsByCarrier]
			if (!carrierData) return null
			const windowData = carrierData[windowKey]
			if (!windowData) return null
			placed = (windowData as any).placed || 0
			notPlaced = (windowData as any).notPlaced || 0
		}

		const entries: { label: string; count: number; color: string }[] = [
			{ label: "Placed", count: placed, color: placementColors["Placed"] },
			{ label: "Not Placed", count: notPlaced, color: placementColors["Not Placed"] },
		]

		const total = placed + notPlaced

		// Always include both entries, even if one has count 0, to ensure pie chart renders correctly
		let cursor = 0
		const wedges = entries.map((e) => {
			const pct = total > 0 ? e.count / total : 0
			const ang = pct * 360
			const piece = {
				...e,
				start: cursor,
				end: cursor + ang,
				pct: Math.round(pct * 1000) / 10,
			}
			cursor += ang
			return piece
		}).filter(e => e.count > 0) // Filter after calculating angles to ensure proper rendering

		return { wedges, total, placed, notPlaced }
	}, [carrierFilter, windowKey, groupBy, _analyticsData])

	// Calculate trend data for line chart
	const trendData = React.useMemo(() => {
		if (trendMetric === "all") {
			// For "all", we need submitted and active data
			const filteredSeries = (_analyticsData?.series ?? []).filter(row => {
				if (!periods.includes(row.period)) return false
				if (carrierFilter !== "ALL" && row.carrier !== carrierFilter) return false
				return true
			})

			const periodData: Record<string, {
				period: string
				submitted: { value: number; carriers?: Record<string, number> }
				active: { value: number; carriers?: Record<string, number> }
			}> = {}

			if (carrierFilter === "ALL") {
				for (const row of filteredSeries) {
					if (!periodData[row.period]) {
						periodData[row.period] = {
							period: row.period,
							submitted: { value: 0, carriers: {} },
							active: { value: 0, carriers: {} },
						}
					}
					if (!periodData[row.period].submitted.carriers) {
						periodData[row.period].submitted.carriers = {}
					}
					if (!periodData[row.period].active.carriers) {
						periodData[row.period].active.carriers = {}
					}
					periodData[row.period].submitted.carriers![row.carrier] = row.submitted
					periodData[row.period].active.carriers![row.carrier] = row.active
				}
			} else {
				for (const row of filteredSeries) {
					if (!periodData[row.period]) {
						periodData[row.period] = {
							period: row.period,
							submitted: { value: row.submitted },
							active: { value: row.active },
						}
					}
				}
			}

			const sortedPeriods = Object.values(periodData).sort((a, b) => {
				const aIdx = parsePeriodToIndex(a.period)
				const bIdx = parsePeriodToIndex(b.period)
				return aIdx - bIdx
			})

			return sortedPeriods as any
		}

		// Filter series data by periods and carrier filter
		const filteredSeries = (_analyticsData?.series ?? []).filter(row => {
			if (!periods.includes(row.period)) return false
			if (carrierFilter !== "ALL" && row.carrier !== carrierFilter) return false
			return true
		})

		// Determine which field to extract based on metric
		const getValue = (row: { persistency: number; placement?: number; submitted: number; active: number; avgPremiumSubmitted: number }) => {
			switch (trendMetric) {
				case "persistency":
					return row.persistency
				case "placement":
					return row.placement ?? 0
				case "submitted":
					return row.submitted
				case "active":
					return row.active
				case "avgprem":
					return row.avgPremiumSubmitted
				default:
					return 0
			}
		}

		// Group by period
		const periodData: Record<string, { period: string; value: number; carriers?: Record<string, number> }> = {}

		if (carrierFilter === "ALL") {
			// Group by period, then by carrier
			for (const row of filteredSeries) {
				if (!periodData[row.period]) {
					periodData[row.period] = {
						period: row.period,
						value: 0,
						carriers: {},
					}
				}
				if (!periodData[row.period].carriers) {
					periodData[row.period].carriers = {}
				}
				periodData[row.period].carriers![row.carrier] = getValue(row)
			}
		} else {
			// Single carrier - just get the values
			for (const row of filteredSeries) {
				if (!periodData[row.period]) {
					periodData[row.period] = {
						period: row.period,
						value: getValue(row),
					}
				}
			}
		}

		// Sort periods chronologically
		const sortedPeriods = Object.values(periodData).sort((a, b) => {
			const aIdx = parsePeriodToIndex(a.period)
			const bIdx = parsePeriodToIndex(b.period)
			return aIdx - bIdx
		})

		return sortedPeriods
	}, [periods, carrierFilter, trendMetric])

	if (!hasAnalyticsAccess) {
		return (
			<div className="space-y-8">
				<div>
					<h1 className="text-4xl font-bold text-foreground mb-2">Analytics</h1>
					<p className="text-muted-foreground">Advanced analytics and insights</p>
				</div>
				<UpgradePrompt
					title="Analytics Requires an Upgrade"
					message="Upgrade to Pro or Expert to access advanced analytics, performance insights, and detailed reporting."
					requiredTier="Pro"
				/>
			</div>
		)
	}

	return (
		isLoading ? (
			<div className="flex w-full flex-col gap-6 p-6">
				{/* Header Skeleton */}
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
					<div className="h-10 bg-muted animate-pulse rounded w-64" />
					<div className="flex items-center gap-2">
						<div className="h-10 bg-muted animate-pulse rounded w-[208px]" />
						<div className="h-10 bg-muted animate-pulse rounded w-[120px]" />
						<div className="h-10 bg-muted animate-pulse rounded w-[160px]" />
						<div className="h-10 bg-muted animate-pulse rounded w-[240px]" />
					</div>
				</div>

				{/* Info Cards Skeleton */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card key={i} className="rounded-md">
							<CardContent className="p-6">
								<div className="h-4 bg-muted animate-pulse rounded w-24 mb-3" />
								<div className="h-8 bg-muted animate-pulse rounded w-16" />
							</CardContent>
						</Card>
					))}
				</div>

				{/* Charts Skeleton */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Chart 1 */}
					<Card className="rounded-md">
						<CardHeader>
							<div className="h-6 bg-muted animate-pulse rounded w-48" />
						</CardHeader>
						<CardContent>
							<div className="h-[400px] bg-muted/30 animate-pulse rounded" />
						</CardContent>
					</Card>

					{/* Chart 2 */}
					<Card className="rounded-md">
						<CardHeader>
							<div className="h-6 bg-muted animate-pulse rounded w-48" />
						</CardHeader>
						<CardContent>
							<div className="h-[400px] bg-muted/30 animate-pulse rounded" />
						</CardContent>
					</Card>
				</div>

				{/* Large Chart Skeleton */}
				<Card className="rounded-md">
					<CardHeader>
						<div className="flex justify-between items-center">
							<div className="h-6 bg-muted animate-pulse rounded w-64" />
							<div className="h-8 bg-muted animate-pulse rounded w-32" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="h-[500px] bg-muted/30 animate-pulse rounded" />
					</CardContent>
				</Card>

				{/* Breakdowns Skeleton */}
				<Tabs defaultValue="status" className="w-full">
					<TabsList className="grid w-full grid-cols-3 rounded-md">
						<TabsTrigger value="status" className="rounded-md">
							<div className="h-4 bg-muted animate-pulse rounded w-16" />
						</TabsTrigger>
						<TabsTrigger value="state" className="rounded-md">
							<div className="h-4 bg-muted animate-pulse rounded w-16" />
						</TabsTrigger>
						<TabsTrigger value="ageBand" className="rounded-md">
							<div className="h-4 bg-muted animate-pulse rounded w-16" />
						</TabsTrigger>
					</TabsList>
					<TabsContent value="status">
						<Card className="rounded-md">
							<CardContent className="p-6">
								<div className="h-[300px] bg-muted/30 animate-pulse rounded" />
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		) : (
			<div className="flex w-full flex-col gap-6 p-6 analytics-content" data-tour="analytics">
			{/* Error Display */}
			{mainAnalyticsError && (
				<QueryErrorDisplay
					error={mainAnalyticsError}
					onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.analyticsData({ view: 'initial' }) })}
					variant="inline"
				/>
			)}
			{/* Header */}
			<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
				<div className="flex items-center gap-4 flex-wrap">
					<h1 className="text-4xl font-bold text-foreground whitespace-nowrap leading-none flex-shrink-0">Agency Analytics</h1>
					<RefreshingIndicator isRefreshing={isRefreshing} />

					<div className="flex items-center gap-2 flex-wrap xl:hidden ml-auto">
						{/* Just Me / Downlines Toggle */}
						<div className="relative bg-muted/50 p-1 rounded-lg">
							{/* Animated background slider */}
							<div
								className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out"
								style={{
									left: viewMode === 'just_me' ? '4px' : 'calc(50%)',
									width: 'calc(50% - 4px)'
								}}
							/>
							<div className="relative z-10 flex">
								<button
									onClick={() => setViewMode('just_me')}
									className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${
										viewMode === 'just_me'
											? 'text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									Just Me
								</button>
								<button
									onClick={() => setViewMode('downlines')}
									className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${
										viewMode === 'downlines'
											? 'text-primary-foreground'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									Downlines
								</button>
							</div>
						</div>

						{/* Time window: 3,6,9,All Time */}
						<Select value={timeWindow} onValueChange={(v) => setTimeWindow(v as any)}>
							<SelectTrigger className="w-[120px] rounded-md h-9 text-sm flex-shrink-0"><SelectValue placeholder="3 Months" /></SelectTrigger>
							<SelectContent className="rounded-md">
								<SelectItem value="3">3 Months</SelectItem>
								<SelectItem value="6">6 Months</SelectItem>
								<SelectItem value="9">9 Months</SelectItem>
								<SelectItem value="all">All Time</SelectItem>
							</SelectContent>
						</Select>

						{/* Carrier selector sourced from JSON */}
						<Select value={carrierFilter} onValueChange={(value) => {
							setCarrierFilter(value)
							if (value === "ALL") {
								setSelectedCarrier(null)
							} else if (groupBy === "carrier") {
								setSelectedCarrier(value)
							}
						}}>
							<SelectTrigger className="w-[160px] rounded-md h-9 text-sm flex-shrink-0"><SelectValue placeholder="All Carriers" /></SelectTrigger>
							<SelectContent className="rounded-md">
								{carriers.map((c) => (
									<SelectItem key={c} value={c}>{c === "ALL" ? "All Carriers" : c}</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Agent Search */}
						<SimpleSearchableSelect
							options={[
								{ value: "", label: "View My Analytics" },
								...allAgents.map(agent => ({ value: agent.id, label: agent.name }))
							]}
							value={selectedAgentId}
							onValueChange={(value) => {
								setSelectedAgentId(value)
							}}
							placeholder="Search agent to view their analytics..."
							searchPlaceholder="Type agent name..."
							className="w-[240px] flex-shrink-0"
						/>
					</div>
				</div>

				{/* Controls for xl screens - right aligned */}
				<div className="hidden xl:flex items-center gap-2 flex-wrap">
					{/* Just Me / Downlines Toggle */}
					<div className="relative bg-muted/50 p-1 rounded-lg">
						{/* Animated background slider */}
						<div
							className="absolute top-1 bottom-1 bg-primary rounded-md transition-all duration-300 ease-in-out"
							style={{
								left: viewMode === 'just_me' ? '4px' : 'calc(50%)',
								width: 'calc(50% - 4px)'
							}}
						/>
						<div className="relative z-10 flex">
							<button
								onClick={() => setViewMode('just_me')}
								className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${
									viewMode === 'just_me'
										? 'text-primary-foreground'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Just Me
							</button>
							<button
								onClick={() => setViewMode('downlines')}
								className={`relative z-10 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-300 min-w-[100px] text-center ${
									viewMode === 'downlines'
										? 'text-primary-foreground'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								Downlines
							</button>
						</div>
					</div>

					{/* Time window: 3,6,9,All Time */}
					<Select value={timeWindow} onValueChange={(v) => setTimeWindow(v as any)}>
						<SelectTrigger className="w-[120px] rounded-md h-9 text-sm flex-shrink-0"><SelectValue placeholder="3 Months" /></SelectTrigger>
						<SelectContent className="rounded-md">
							<SelectItem value="3">3 Months</SelectItem>
							<SelectItem value="6">6 Months</SelectItem>
							<SelectItem value="9">9 Months</SelectItem>
							<SelectItem value="all">All Time</SelectItem>
						</SelectContent>
					</Select>

					{/* Carrier selector sourced from JSON */}
					<Select value={carrierFilter} onValueChange={(value) => {
						setCarrierFilter(value)
						if (value === "ALL") {
							setSelectedCarrier(null)
						} else if (groupBy === "carrier") {
							setSelectedCarrier(value)
						}
					}}>
						<SelectTrigger className="w-[160px] rounded-md h-9 text-sm flex-shrink-0"><SelectValue placeholder="All Carriers" /></SelectTrigger>
						<SelectContent className="rounded-md">
							{carriers.map((c) => (
								<SelectItem key={c} value={c}>{c === "ALL" ? "All Carriers" : c}</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Agent Search */}
					<SimpleSearchableSelect
						options={[
							{ value: "", label: "View My Analytics" },
							...allAgents.map(agent => ({ value: agent.id, label: agent.name }))
						]}
						value={selectedAgentId}
						onValueChange={(value) => {
							setSelectedAgentId(value)
						}}
						placeholder="Search agent to view their analytics..."
						searchPlaceholder="Type agent name..."
						className="w-[240px] flex-shrink-0"
					/>

					<Button
						className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md h-9 text-sm whitespace-nowrap flex-shrink-0"
						onClick={() => setIsUploadModalOpen(true)}
					>
						Upload Reports
					</Button>

					{userRole === 'admin' && (
						<Button
							variant="outline"
							className="rounded-md border-2 border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 font-medium h-9 text-sm whitespace-nowrap flex-shrink-0"
							onClick={() => {
								window.location.href = '/ai-chat'
							}}
						>
							<span className="mr-1.5">✨</span>
							Ask AI to make Custom graphs
						</Button>
					)}
				</div>

				{/* Buttons row - visible on smaller screens only */}
				<div className="flex items-center gap-2 justify-end xl:hidden flex-wrap">
					<Button
						className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md h-9 text-sm whitespace-nowrap flex-shrink-0"
						onClick={() => setIsUploadModalOpen(true)}
					>
						Upload Reports
					</Button>

					{userRole === 'admin' && (
						<Button
							variant="outline"
							className="rounded-md border-2 border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 font-medium h-9 text-sm whitespace-nowrap flex-shrink-0"
							onClick={() => {
								window.location.href = '/ai-chat'
							}}
						>
							<span className="mr-1.5">✨</span>
							Ask AI to make Custom graphs
						</Button>
					)}
				</div>
			</div>

		{/* Upload Policy Reports Modal */}
		<UploadPolicyReportsModal
			isOpen={isUploadModalOpen}
			onClose={() => setIsUploadModalOpen(false)}
		/>

			{/* KPI tiles centered to middle 1/3rd */}
			<div className="flex w-full justify-center">
				<div className="grid w-full max-w-4xl grid-cols-4 gap-3">
					<Card className="rounded-md">
						<CardContent className="p-4">
							<div className="flex items-center gap-2">
								<div className="text-xs text-muted-foreground uppercase font-medium">Persistency</div>
								<div className="relative">
									<Info 
										className="h-3.5 w-3.5 text-muted-foreground cursor-help" 
										onMouseEnter={() => setShowPersistencyTooltip(true)}
										onMouseLeave={() => setShowPersistencyTooltip(false)}
									/>
									{showPersistencyTooltip && (
										<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-popover border border-border rounded-md shadow-lg text-xs text-popover-foreground z-50 pointer-events-none">
											The percentage of policies that the carrier has accepted that are still active
										</div>
									)}
								</div>
							</div>
							<div className="text-2xl font-bold mt-2">{(topStats.persistency * 100).toFixed(2)}%</div>
						</CardContent>
					</Card>
					<Card className="rounded-md">
						<CardContent className="p-4">
							<div className="flex items-center gap-2">
								<div className="text-xs text-muted-foreground uppercase font-medium">Placement</div>
								<div className="relative">
									<Info 
										className="h-3.5 w-3.5 text-muted-foreground cursor-help" 
										onMouseEnter={() => setShowPlacementTooltip(true)}
										onMouseLeave={() => setShowPlacementTooltip(false)}
									/>
									{showPlacementTooltip && (
										<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-popover border border-border rounded-md shadow-lg text-xs text-popover-foreground z-50 pointer-events-none">
											The percentage of policies that made it past the application phase and became active for any time
										</div>
									)}
								</div>
							</div>
							<div className="text-2xl font-bold mt-2">{(topStats.placement * 100).toFixed(2)}%</div>
						</CardContent>
					</Card>
					<Card className="rounded-md">
						<CardContent className="p-4">
							<div className="text-xs text-muted-foreground uppercase font-medium">Submitted</div>
							<div className="text-2xl font-bold mt-2">{numberWithCommas(topStats.submitted)}</div>
						</CardContent>
					</Card>
					<Card className="rounded-md">
						<CardContent className="p-4">
							<div className="text-xs text-muted-foreground uppercase font-medium">Active</div>
							<div className="text-2xl font-bold mt-2">{numberWithCommas(topStats.active)}</div>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Total Submitted Business / Status Breakdown */}
			<div className="relative">
			<Card className="rounded-md">
				<CardContent className="p-4 sm:p-6">
					{isLoading ? (
						<>
							<div className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">TOTAL SUBMITTED BUSINESS</div>
							{/* Tabs */}
							<div className="mb-4 flex flex-wrap gap-2 justify-center">
								{[
									{ key: "carrier", label: "By Carrier" },
									{ key: "downline", label: "By Downline" },
									{ key: "state", label: "By State" },
									{ key: "age", label: "By Age" },
									{ key: "persistency", label: "By Persistency" },
									{ key: "placement", label: "By Placement" },
								].map((g) => (
									<Button
										key={g.key}
										variant={groupBy === g.key ? "default" : "outline"}
										size="sm"
										disabled
										className={`rounded-md ${groupBy === g.key ? 'bg-foreground hover:bg-foreground/90 text-background' : ''}`}
									>
										{g.label}
									</Button>
								))}
							</div>
							<div className="flex items-center justify-center gap-8">
								<div className="relative h-[320px] w-[320px]">
									<div className="h-full w-full rounded-full bg-muted animate-pulse" />
								</div>
								<div className="flex flex-col gap-3 min-w-[250px]">
									<div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Carriers</div>
									<div className="flex flex-col gap-2">
										<div className="h-4 w-32 bg-muted animate-pulse rounded" />
										<div className="h-4 w-28 bg-muted animate-pulse rounded" />
										<div className="h-4 w-24 bg-muted animate-pulse rounded" />
									</div>
								</div>
							</div>
						</>
					) : totalSubmitted === 0 && wedges.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-4 py-12">
							<div className="text-sm text-muted-foreground text-center">
								No data is available for {carrierFilter === "ALL" ? "all carriers" : carrierFilter} over the {getTimeframeLabel(timeWindow)} timeframe.
							</div>
						</div>
					) : (detailCarrier || groupBy === "state" || groupBy === "age" || groupBy === "persistency" || groupBy === "placement") ? (						// Breakdown View (Status, State, Age, Persistency, or Placement)
						<>
							<div className="mb-4 flex items-center gap-3">
								<div className="text-xs font-medium tracking-wide text-muted-foreground">
									{groupBy === "carrier" && detailCarrier
										? `${detailCarrier.toUpperCase()} - STATUS BREAKDOWN`
										: groupBy === "state"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY STATE`
										: groupBy === "age"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY AGE`
										: groupBy === "persistency"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY PERSISTENCY`
										: groupBy === "placement"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY PLACEMENT`
										: "BREAKDOWN"}
								</div>
								{(groupBy === "carrier" && detailCarrier) && (
									<Button
										onClick={() => {
											setSelectedCarrier(null)
											setCarrierFilter("ALL")
										}}
										variant="outline"
										size="sm"
										className="h-6 text-xs px-2"
									>
										Back to Carriers
									</Button>
								)}
							</div>

							{/* Tabs */}
							<div className="mb-4 flex flex-wrap gap-2 justify-center">
								{[
									{ key: "carrier", label: "By Carrier" },
									{ key: "downline", label: "By Downline" },
									{ key: "state", label: "By State" },
									{ key: "age", label: "By Age" },
									{ key: "persistency", label: "By Persistency" },
									{ key: "placement", label: "By Placement" },
								].map((g) => (
									<Button
										key={g.key}
										variant={groupBy === g.key ? "default" : "outline"}
										size="sm"
										onClick={() => {
											setGroupBy(g.key)
											if (g.key !== "carrier" && g.key !== "downline") {
												setSelectedCarrier(null)
											}
											if (g.key !== "downline") {
												setDownlineTitle(null)
											}
										}}
										className={`rounded-md ${groupBy === g.key ? 'bg-foreground hover:bg-foreground/90 text-background' : ''}`}
									>
										{g.label}
									</Button>
								))}
							</div>

							{/* Render breakdown charts based on groupBy */}
							{groupBy === "carrier" && statusBreakdown && (
								<div className="flex flex-col items-center justify-center gap-6">
									{/* Donut Chart */}
									<div className="relative h-[320px] w-[320px]">
										<svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
											<defs>
												<filter id="shadow-status" x="-20%" y="-20%" width="140%" height="140%">
													<feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
												</filter>
												<filter id="darken-status">
													<feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
												</filter>
											</defs>
											<circle cx={160} cy={160} r={100} style={{ fill: 'hsl(var(--card))' }} />
											<g filter="url(#shadow-status)">
												{statusBreakdown.wedges.map((w, idx) => {
													const path = describeDonutArc(160, 160, 150, 100, w.start, w.end)
													const mid = (w.start + w.end) / 2
													const center = polarToCartesian(160, 160, 125, mid)
													const isHovered = hoverStatusInfo?.status === w.status
													const isOtherHovered = hoverStatusInfo !== null && !isHovered
													// Check if this is a full circle (360 degrees)
													const isFullCircle = Math.abs((w.end - w.start) - 360) < 0.01

													return (
														<path
															key={w.status}
															d={path}
															fill={w.color}
															stroke={isFullCircle ? w.color : "#fff"}
															strokeWidth={2}
															strokeLinejoin="round"
															opacity={isOtherHovered ? 0.4 : 1}
															filter={isHovered ? "url(#darken-status)" : undefined}
															style={{
																transform: isHovered ? "scale(1.05)" : "scale(1)",
																transformOrigin: "160px 160px",
																transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
																animationDelay: `${idx * 0.1}s`,
															}}
															className="cursor-pointer pie-slice-animate"
															onMouseEnter={() => setHoverStatusInfo({
																x: center.x,
																y: center.y,
																status: w.status,
																count: w.count,
																pct: w.pct,
															})}
															onMouseLeave={() => setHoverStatusInfo(null)}
														/>
													)
												})}
											</g>
										</svg>
										{hoverStatusInfo && (
											<div
												className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10"
												style={{ left: hoverStatusInfo.x, top: hoverStatusInfo.y }}
											>
												<div className="mb-1 text-sm font-semibold">{hoverStatusInfo.status}</div>
												<div className="text-white/90">
													{numberWithCommas(hoverStatusInfo.count)} ({hoverStatusInfo.pct}%)
												</div>
											</div>
										)}
									</div>

									{/* Status Legend */}
									<div className="flex flex-wrap justify-center gap-4 mt-4">
										{statusBreakdown.legendEntries.length === 0 ? (
											<div className="text-sm text-muted-foreground">No data in range</div>
										) : (
											statusBreakdown.legendEntries.map((w) => (
												<div key={w.status} className="flex items-center gap-2 text-sm">
													<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: w.color }} />
													<span>{w.status} ({w.pct}%)</span>
												</div>
											))
										)}
									</div>
								</div>
							)}

							{/* State Breakdown */}
							{groupBy === "state" && stateBreakdown && (
								<div className="flex flex-col items-center justify-center gap-6">
									{stateBreakdown.isFullyUnknown ? (
										<div className="flex flex-col items-center justify-center gap-4 py-12">
											<div className="text-sm text-muted-foreground text-center">
												There is not enough data for this to create a breakdown based on state
											</div>
										</div>
									) : (
										<>
											<div className="relative h-[320px] w-[320px]">
												<svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
													<defs>
														<filter id="shadow-breakdown" x="-20%" y="-20%" width="140%" height="140%">
															<feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
														</filter>
														<filter id="darken-breakdown">
															<feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
														</filter>
													</defs>
													<g filter="url(#shadow-breakdown)">
														{stateBreakdown.wedges.map((w, idx) => {
															const path = describeArc(160, 160, 150, w.start, w.end)
															const mid = (w.start + w.end) / 2
															const center = polarToCartesian(160, 160, 90, mid)
															const isHovered = hoverBreakdownInfo?.label === w.label
															const isOtherHovered = hoverBreakdownInfo !== null && !isHovered
															// Check if this is a full circle (360 degrees)
															const isFullCircle = Math.abs((w.end - w.start) - 360) < 0.01

															return (
																<path
																	key={w.label}
																	d={path}
																	fill={w.color}
																	stroke={isFullCircle ? w.color : "#fff"}
																	strokeWidth={2}
																	strokeLinejoin="round"
																	opacity={isOtherHovered ? 0.4 : 1}
																	filter={isHovered ? "url(#darken-breakdown)" : undefined}
																	style={{
																		transform: isHovered ? "scale(1.05)" : "scale(1)",
																		transformOrigin: "160px 160px",
																		transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
																		animationDelay: `${idx * 0.1}s`,
																	}}
																	className="cursor-pointer pie-slice-animate"
																	onMouseEnter={() => setHoverBreakdownInfo({
																		x: center.x,
																		y: center.y,
																		label: w.label,
																		value: w.value,
																		pct: w.pct,
																		groupedStates: stateBreakdown.groupedStates?.[w.label],
																		total: stateBreakdown.total,
																	})}
																	onMouseLeave={() => {
																		// For "Other" slice with grouped states, don't hide immediately
																		// Let the tooltip handle its own visibility
																		const hasGroupedStates = stateBreakdown.groupedStates?.[w.label] && stateBreakdown.groupedStates[w.label].length > 0
																		if (!hasGroupedStates) {
																			setHoverBreakdownInfo(null)
																		}
																	}}
																/>
															)
														})}
													</g>
												</svg>
												{hoverBreakdownInfo && (
													<div
														className="absolute animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10 max-w-[280px]"
														style={{ 
															left: `${hoverBreakdownInfo.x}px`,
															top: `${hoverBreakdownInfo.y}px`,
															transform: 'translate(-50%, -50%)',
															maxHeight: 'min(calc(100vh - 40px), 400px)',
															maxWidth: 'min(280px, calc(100vw - 40px))',
															overflow: 'hidden',
															display: 'flex',
															flexDirection: 'column',
															pointerEvents: hoverBreakdownInfo.groupedStates && hoverBreakdownInfo.groupedStates.length > 0 ? 'auto' : 'none',
														}}
														onMouseEnter={(e) => {
															if (hoverBreakdownInfo.groupedStates && hoverBreakdownInfo.groupedStates.length > 0) {
																e.stopPropagation()
															}
														}}
														onMouseLeave={() => {
															if (hoverBreakdownInfo.groupedStates && hoverBreakdownInfo.groupedStates.length > 0) {
																setHoverBreakdownInfo(null)
															}
														}}
													>
														<div className="mb-1 text-sm font-semibold flex-shrink-0 pointer-events-none">{hoverBreakdownInfo.label}</div>
														<div className="text-white/90 flex-shrink-0 whitespace-nowrap pointer-events-none">
															{numberWithCommas(hoverBreakdownInfo.value)} ({hoverBreakdownInfo.pct}%)
														</div>
														{hoverBreakdownInfo.groupedStates && hoverBreakdownInfo.groupedStates.length > 0 && (
															<div className="mt-2 pt-2 border-t border-white/20 flex-shrink-0">
																<div className="text-[10px] text-white/70 mb-1 pointer-events-none">States included:</div>
																<div 
																	className="space-y-1 max-h-[80px] overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0 overscroll-contain pointer-events-auto" 
																	style={{ WebkitOverflowScrolling: 'touch' }}
																>
																	{hoverBreakdownInfo.groupedStates.map((state) => {
																		const statePct = hoverBreakdownInfo.total && hoverBreakdownInfo.total > 0 
																			? Math.round((state.value / hoverBreakdownInfo.total) * 1000) / 10 
																			: state.pct
																		return (
																			<div key={state.label} className="text-white/90 whitespace-nowrap pointer-events-none">
																				{state.label}: {numberWithCommas(state.value)} ({statePct}%)
																			</div>
																		)
																	})}
																</div>
															</div>
														)}
													</div>
												)}
											</div>

											<div className="flex flex-wrap justify-center gap-4 mt-4">
												{stateBreakdown.wedges.length === 0 ? (
													<div className="text-sm text-muted-foreground">No data in range</div>
												) : (
													stateBreakdown.wedges.map((w) => (
														<div key={w.label} className="flex items-center gap-2 text-sm">
															<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: w.color }} />
															<span>{w.label} ({w.pct}%)</span>
														</div>
													))
												)}
											</div>
										</>
									)}
								</div>
							)}

							{/* Age Breakdown */}
							{groupBy === "age" && ageBreakdown && (
								<div className="flex flex-col items-center justify-center gap-6">
									{ageBreakdown.isFullyUnknown ? (
										<div className="flex flex-col items-center justify-center gap-4 py-12">
											<div className="text-sm text-muted-foreground text-center">
												There is not enough data for this to create a breakdown based on age
											</div>
										</div>
									) : (
										<>
											<div className="relative h-[320px] w-[320px]">
												<svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
													<defs>
														<filter id="shadow-age" x="-20%" y="-20%" width="140%" height="140%">
															<feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
														</filter>
														<filter id="darken-age">
															<feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
														</filter>
													</defs>
													<g filter="url(#shadow-age)">
														{ageBreakdown.wedges.map((w, idx) => {
															const path = describeArc(160, 160, 150, w.start, w.end)
															const mid = (w.start + w.end) / 2
															const center = polarToCartesian(160, 160, 90, mid)
															const isHovered = hoverBreakdownInfo?.label === w.label
															const isOtherHovered = hoverBreakdownInfo !== null && !isHovered
															// Check if this is a full circle (360 degrees)
															const isFullCircle = Math.abs((w.end - w.start) - 360) < 0.01

															return (
																<path
																	key={w.label}
																	d={path}
																	fill={w.color}
																	stroke={isFullCircle ? w.color : "#fff"}
																	strokeWidth={2}
																	strokeLinejoin="round"
																	opacity={isOtherHovered ? 0.4 : 1}
																	filter={isHovered ? "url(#darken-age)" : undefined}
																	style={{
																		transform: isHovered ? "scale(1.05)" : "scale(1)",
																		transformOrigin: "160px 160px",
																		transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
																		animationDelay: `${idx * 0.1}s`,
																	}}
																	className="cursor-pointer pie-slice-animate"
																	onMouseEnter={() => setHoverBreakdownInfo({
																		x: center.x,
																		y: center.y,
																		label: w.label,
																		value: w.value,
																		pct: w.pct,
																	})}
																	onMouseLeave={() => setHoverBreakdownInfo(null)}
																/>
															)
														})}
													</g>
												</svg>
												{hoverBreakdownInfo && (
													<div
														className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10"
														style={{ left: hoverBreakdownInfo.x, top: hoverBreakdownInfo.y }}
													>
														<div className="mb-1 text-sm font-semibold">{hoverBreakdownInfo.label}</div>
														<div className="text-white/90 whitespace-nowrap">
															{numberWithCommas(hoverBreakdownInfo.value)} ({hoverBreakdownInfo.pct}%)
														</div>
													</div>
												)}
											</div>

											<div className="flex flex-wrap justify-center gap-4 mt-4">
												{ageBreakdown.wedges.length === 0 ? (
													<div className="text-sm text-muted-foreground">No data in range</div>
												) : (
													ageBreakdown.wedges.map((w) => (
														<div key={w.label} className="flex items-center gap-2 text-sm">
															<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: w.color }} />
															<span>{w.label} ({w.pct}%)</span>
														</div>
													))
												)}
											</div>
										</>
									)}
								</div>
							)}

							{/* Persistency Breakdown */}
							{groupBy === "persistency" && persistencyBreakdown && (
								<div className="flex flex-col items-center justify-center gap-6">
									<div className="relative h-[320px] w-[320px]">
										<svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
											<defs>
												<filter id="shadow-persistency" x="-20%" y="-20%" width="140%" height="140%">
													<feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
												</filter>
												<filter id="darken-persistency">
													<feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
												</filter>
											</defs>
											<g filter="url(#shadow-persistency)">
												{persistencyBreakdown.wedges.map((w, idx) => {
													const path = describeArc(160, 160, 150, w.start, w.end)
													const mid = (w.start + w.end) / 2
													const center = polarToCartesian(160, 160, 90, mid)
													const isHovered = hoverPersistencyInfo?.label === w.label
													const isOtherHovered = hoverPersistencyInfo !== null && !isHovered
													// Check if this is a full circle (360 degrees)
													const isFullCircle = Math.abs((w.end - w.start) - 360) < 0.01

													return (
														<path
															key={w.label}
															d={path}
															fill={w.color}
															stroke={isFullCircle ? w.color : "#fff"}
															strokeWidth={2}
															strokeLinejoin="round"
															opacity={isOtherHovered ? 0.4 : 1}
															filter={isHovered ? "url(#darken-persistency)" : undefined}
															style={{
																transform: isHovered ? "scale(1.05)" : "scale(1)",
																transformOrigin: "160px 160px",
																transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
																animationDelay: `${idx * 0.1}s`,
															}}
															className="cursor-pointer pie-slice-animate"
															onMouseEnter={() => setHoverPersistencyInfo({
																x: center.x,
																y: center.y,
																label: w.label,
																count: w.count,
																pct: w.pct,
															})}
															onMouseLeave={() => setHoverPersistencyInfo(null)}
														/>
													)
												})}
											</g>
										</svg>
										{hoverPersistencyInfo && (
											<div
												className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10"
												style={{ left: hoverPersistencyInfo.x, top: hoverPersistencyInfo.y }}
											>
												<div className="mb-1 text-sm font-semibold">{hoverPersistencyInfo.label}</div>
												<div className="text-white/90 whitespace-nowrap">
													{numberWithCommas(hoverPersistencyInfo.count)} ({hoverPersistencyInfo.pct}%)
												</div>
											</div>
										)}
									</div>

									<div className="flex flex-wrap justify-center gap-4 mt-4">
										{persistencyBreakdown.wedges.length === 0 ? (
											<div className="text-sm text-muted-foreground">No data in range</div>
										) : (
											persistencyBreakdown.wedges.map((w) => (
												<div key={w.label} className="flex items-center gap-2 text-sm">
													<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: w.color }} />
													<span>{w.label} ({w.pct}%)</span>
												</div>
											))
										)}
									</div>
								</div>
							)}

							{/* Placement Breakdown */}
							{groupBy === "placement" && placementBreakdown && (
								<div className="flex flex-col items-center justify-center gap-6">
									<div className="relative h-[320px] w-[320px]">
										<svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
											<defs>
												<filter id="shadow-placement" x="-20%" y="-20%" width="140%" height="140%">
													<feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
												</filter>
												<filter id="darken-placement">
													<feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
												</filter>
											</defs>
											<g filter="url(#shadow-placement)">
												{placementBreakdown.wedges.map((w, idx) => {
													const path = describeArc(160, 160, 150, w.start, w.end)
													const mid = (w.start + w.end) / 2
													const center = polarToCartesian(160, 160, 90, mid)
													const isHovered = hoverPlacementInfo?.label === w.label
													const isOtherHovered = hoverPlacementInfo !== null && !isHovered
													// Check if this is a full circle (360 degrees)
													const isFullCircle = Math.abs((w.end - w.start) - 360) < 0.01

													return (
														<path
															key={w.label}
															d={path}
															fill={w.color}
															stroke={isFullCircle ? w.color : "#fff"}
															strokeWidth={2}
															strokeLinejoin="round"
															opacity={isOtherHovered ? 0.4 : 1}
															filter={isHovered ? "url(#darken-placement)" : undefined}
															style={{
																transform: isHovered ? "scale(1.05)" : "scale(1)",
																transformOrigin: "160px 160px",
																transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
																animationDelay: `${idx * 0.1}s`,
															}}
															className="cursor-pointer pie-slice-animate"
															onMouseEnter={() => setHoverPlacementInfo({
																x: center.x,
																y: center.y,
																label: w.label,
																count: w.count,
																pct: w.pct,
															})}
															onMouseLeave={() => setHoverPlacementInfo(null)}
														/>
													)
												})}
											</g>
										</svg>
										{hoverPlacementInfo && (
											<div
												className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10"
												style={{ left: hoverPlacementInfo.x, top: hoverPlacementInfo.y }}
											>
												<div className="mb-1 text-sm font-semibold">{hoverPlacementInfo.label}</div>
												<div className="text-white/90 whitespace-nowrap">
													{numberWithCommas(hoverPlacementInfo.count)} ({hoverPlacementInfo.pct}%)
												</div>
											</div>
										)}
									</div>

									<div className="flex flex-wrap justify-center gap-4 mt-4">
										{placementBreakdown.wedges.length === 0 ? (
											<div className="text-sm text-muted-foreground">No data in range</div>
										) : (
											placementBreakdown.wedges.map((w) => (
												<div key={w.label} className="flex items-center gap-2 text-sm">
													<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: w.color }} />
													<span>{w.label} ({w.pct}%)</span>
												</div>
											))
										)}
									</div>
								</div>
							)}
						</>
					) : (
						// Carrier Pie Chart View or Downline View
						<>
							{groupBy === "downline" ? (
								<div className="mb-4 flex items-center gap-3">
									<div className="text-xs font-medium tracking-wide text-muted-foreground">
										{carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - {downlineTitle || "Your Direct Downline Distribution"}
									</div>
									{/* Breadcrumb trail - shown right before reset button */}
									{downlineBreadcrumbInfo && !downlineBreadcrumbInfo.isAtRoot && (
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<span 
												onClick={() => downlineChartRef.current?.navigateToBreadcrumb(-1)}
												className="opacity-70 cursor-pointer hover:opacity-100 hover:text-foreground transition-colors outline-none focus:outline-none"
												tabIndex={0}
												onKeyDown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault()
														downlineChartRef.current?.navigateToBreadcrumb(-1)
													}
												}}
											>
												You
											</span>
											{downlineBreadcrumbInfo.breadcrumbs.map((crumb, idx) => (
												<React.Fragment key={crumb.agentId}>
													<span className="opacity-50">→</span>
													<span 
														onClick={() => downlineChartRef.current?.navigateToBreadcrumb(idx)}
														className="opacity-70 cursor-pointer hover:opacity-100 hover:text-foreground transition-colors outline-none focus:outline-none"
														tabIndex={0}
														onKeyDown={(e) => {
															if (e.key === 'Enter' || e.key === ' ') {
																e.preventDefault()
																downlineChartRef.current?.navigateToBreadcrumb(idx)
															}
														}}
													>
														{crumb.agentName}
													</span>
												</React.Fragment>
											))}
											<span className="opacity-50">→</span>
											<span className="opacity-90">
												{downlineBreadcrumbInfo.currentAgentName}
											</span>
										</div>
									)}
									{(downlineTitle && downlineTitle !== "Your Direct Downline Distribution") && (
										<Button
											onClick={() => {
												downlineChartRef.current?.reset()
												setDownlineTitle("Your Direct Downline Distribution")
											}}
											variant="outline"
											size="sm"
											className="h-6 text-xs px-2"
										>
											Reset
										</Button>
									)}
								</div>
							) : (
								<div className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">
									TOTAL SUBMITTED BUSINESS
								</div>
							)}

							{/* Tabs */}
							<div className="mb-4 flex flex-wrap gap-2 justify-center">
								{[
									{ key: "carrier", label: "By Carrier" },
									{ key: "downline", label: "By Downline" },
									{ key: "state", label: "By State" },
									{ key: "age", label: "By Age" },
									{ key: "persistency", label: "By Persistency" },
									{ key: "placement", label: "By Placement" },
								].map((g) => (
									<Button
										key={g.key}
										variant={groupBy === g.key ? "default" : "outline"}
										size="sm"
										onClick={() => {
											setGroupBy(g.key)
											if (g.key !== "downline") {
												setDownlineTitle(null)
											}
										}}
										className={`rounded-md ${groupBy === g.key ? 'bg-foreground hover:bg-foreground/90 text-background' : ''}`}
									>
										{g.label}
									</Button>
								))}
							</div>

							{/* Downline Production Distribution Tab */}
							{groupBy === "downline" ? (
								userId ? (
									<DownlineProductionChart 
										ref={downlineChartRef}
										userId={userId} 
										timeWindow={timeWindow} 
										embedded={true}
										onTitleChange={setDownlineTitle}
										onBreadcrumbChange={setDownlineBreadcrumbInfo}
									/>
								) : (
									<div className="flex flex-col items-center justify-center gap-6 py-8">
										<div className="h-5 w-64 bg-muted animate-pulse rounded" />
										<div className="relative h-[320px] w-[320px]">
											<div className="h-full w-full rounded-full bg-muted animate-pulse" />
										</div>
										<div className="flex flex-wrap justify-center gap-4 mt-4">
											<div className="h-4 w-48 bg-muted animate-pulse rounded" />
											<div className="h-4 w-40 bg-muted animate-pulse rounded" />
											<div className="h-4 w-44 bg-muted animate-pulse rounded" />
										</div>
									</div>
								)
							) : (
								<>
									{/* WARNING: DO NOT CHANGE THE LEGEND POSITION - Legend MUST be below the pie chart, NOT next to it */}
									<div className="flex flex-col items-center justify-center gap-6">
						{/* SVG pie with hover */}
						<div className="relative h-[320px] w-[320px]">
							<svg width={320} height={320} viewBox="0 0 320 320" className="overflow-visible">
								<defs>
									<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
										<feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
									</filter>
									<filter id="darken">
										<feColorMatrix type="matrix" values="0.7 0 0 0 0 0 0.7 0 0 0 0 0 0.7 0 0 0 0 0 1 0"/>
									</filter>
								</defs>
								<g filter="url(#shadow)">
									{wedges.map((w, idx) => {
										const path = describeArc(160, 160, 150, w.start, w.end)
										const mid = (w.start + w.end) / 2
										const center = polarToCartesian(160, 160, 90, mid)
										const agg = byCarrierAgg[w.label]
										const persistencyPct = agg.active + agg.inactive > 0 ? (agg.active / (agg.active + agg.inactive)) * 100 : 0
										const isHovered = hoverInfo?.label === w.label
										const isOtherHovered = hoverInfo !== null && !isHovered
										// Check if this is a full circle (360 degrees)
										const isFullCircle = Math.abs((w.end - w.start) - 360) < 0.01

										return (
											<path
												key={w.label}
												d={path}
												fill={w.color}
												stroke={isFullCircle ? w.color : "#fff"}
												strokeWidth={2}
												strokeLinejoin="round"
												opacity={isOtherHovered ? 0.4 : 1}
												filter={isHovered ? "url(#darken)" : undefined}
												style={{
													transform: isHovered ? "scale(1.05)" : "scale(1)",
													transformOrigin: "160px 160px",
													transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
													animationDelay: `${idx * 0.1}s`,
												}}
												className="cursor-pointer pie-slice-animate"
												onMouseEnter={() => setHoverInfo({
													x: center.x,
													y: center.y,
													label: w.label,
													submitted: agg.submitted,
													sharePct: w.pct,
													persistencyPct: Math.round(persistencyPct * 10) / 10,
													active: agg.active,
												})}
												onMouseLeave={() => setHoverInfo(null)}
												onClick={() => {
													setSelectedCarrier(w.label)
													setCarrierFilter(w.label)
													setGroupBy("carrier")
												}}
											/>
										)
									})}
								</g>
							</svg>
							{hoverInfo && (
								<div
									className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10 min-w-[200px]"
									style={{ left: hoverInfo.x, top: hoverInfo.y }}
								>
									<div className="mb-1 text-sm font-semibold whitespace-nowrap">{hoverInfo.label}</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2 whitespace-nowrap"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-white/80 flex-shrink-0" /><span>{numberWithCommas(hoverInfo.submitted)} Total Submitted</span></div>
										<div className="text-white/90 whitespace-nowrap">{hoverInfo.sharePct}% of Total Business</div>
										<div className="text-white/90 whitespace-nowrap">{hoverInfo.persistencyPct}% Persistency Rate</div>
										<div className="text-white/90 whitespace-nowrap">{numberWithCommas(hoverInfo.active)} Active Policies</div>
									</div>
									<div className="mt-2 text-[10px] italic text-white/70 whitespace-nowrap">Click to see status breakdown</div>
								</div>
							)}
						</div>

						{/* Legend below the pie chart - DO NOT MOVE THIS TO THE SIDE */}
						<div className="flex flex-wrap justify-center gap-4 mt-4">
							{wedges.length === 0 ? (
								<div className="text-sm text-muted-foreground">No data in range</div>
							) : (
								wedges.map((l) => (
									<div key={l.label} className="flex items-center gap-2 text-sm">
										<span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
										<span>{l.label} ({l.pct}%)</span>
									</div>
								))
							)}
						</div>
					</div>
								</>
							)}
						</>
					)}
				</CardContent>
			</Card>
				</div>

			{/* Performance Trends */}
			<div className="relative">
			<Card className="rounded-md">
				<CardContent className="p-4 sm:p-6">
					<div className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">PERFORMANCE TRENDS</div>
					<div className="mb-4 flex flex-wrap gap-2 justify-center">
						{[
							{ key: "persistency", label: "Persistency Rate" },
							{ key: "placement", label: "Placement Rate" },
							{ key: "submitted", label: "Submitted Volume" },
							{ key: "active", label: "Active Policies" },
							{ key: "avgprem", label: "Avg Premium" },
							{ key: "all", label: "Show All" },
						].map((m) => (
							<Button 
								key={m.key} 
								variant={trendMetric === m.key ? "default" : "outline"} 
								size="sm" 
								onClick={() => setTrendMetric(m.key as "persistency" | "placement" | "submitted" | "active" | "avgprem" | "all")} 
								className={`rounded-md ${trendMetric === m.key ? 'bg-foreground hover:bg-foreground/90 text-background' : ''}`}
							>
								{m.label}
							</Button>
						))}
					</div>
					{trendData && trendData.length > 0 ? (
						(() => {
							// Handle "Show All" case - show submitted and active together
							if (trendMetric === "all") {
								// Calculate min/max for submitted and active
								let minValue = Infinity
								let maxValue = -Infinity

								for (const data of trendData as any[]) {
									// Check submitted values
									if (carrierFilter === "ALL") {
										// Calculate cumulative submitted for this period
										let cumulativeSubmitted = 0
										if (data.submitted?.carriers) {
											for (const value of Object.values(data.submitted.carriers)) {
												if (value !== undefined && value !== null) {
													const val = value as number
													minValue = Math.min(minValue, val)
													maxValue = Math.max(maxValue, val)
													cumulativeSubmitted += val
												}
											}
										}
										if (cumulativeSubmitted > 0) {
											minValue = Math.min(minValue, cumulativeSubmitted)
											maxValue = Math.max(maxValue, cumulativeSubmitted)
										}

										// Calculate cumulative active for this period
										let cumulativeActive = 0
										if (data.active?.carriers) {
											for (const value of Object.values(data.active.carriers)) {
												if (value !== undefined && value !== null) {
													const val = value as number
													minValue = Math.min(minValue, val)
													maxValue = Math.max(maxValue, val)
													cumulativeActive += val
												}
											}
										}
										if (cumulativeActive > 0) {
											minValue = Math.min(minValue, cumulativeActive)
											maxValue = Math.max(maxValue, cumulativeActive)
										}
									} else {
										if (data.submitted?.value !== undefined && data.submitted.value !== null) {
											minValue = Math.min(minValue, data.submitted.value)
											maxValue = Math.max(maxValue, data.submitted.value)
										}
										if (data.active?.value !== undefined && data.active.value !== null) {
											minValue = Math.min(minValue, data.active.value)
											maxValue = Math.max(maxValue, data.active.value)
										}
									}
								}

								if (minValue === Infinity || maxValue === -Infinity) {
									minValue = 0
									maxValue = 100
								}

								// Always start at 0 for non-persistency metrics
								minValue = 0
								// Add small padding to max
								const padding = maxValue * 0.1 || 1
								maxValue = maxValue + padding

								const chartHeight = 240
								const chartBottom = 260

								const valueToY = (value: number) => {
									if (maxValue === 0) return chartBottom
									const normalized = value / maxValue
									return chartBottom - (normalized * chartHeight)
								}

								const formatYLabel = (value: number): string => {
									return numberWithCommas(Math.round(value))
								}

								return (
									<div className="flex gap-6">
										<div className="relative h-[300px] flex-1">
										<svg width="100%" height="100%" viewBox="0 0 800 300" className="overflow-visible">
											<defs>
												<linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
													<stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.1" />
													<stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.3" />
												</linearGradient>
											</defs>

											<rect x="60" y="20" width="720" height="240" fill="transparent" />

											{(() => {
												// Generate scale values and use the max for consistent scaling
												const scaleValues = generateScaleValues(minValue, maxValue, 5)
												const scaleMax = scaleValues[scaleValues.length - 1]
												const valueToYWithScale = (value: number) => {
													if (scaleMax === 0) return chartBottom
													const normalized = value / scaleMax
													return chartBottom - (normalized * chartHeight)
												}

												return (
													<>
														{/* Grid lines */}
														{scaleValues.map((value, i) => {
															const yPos = valueToYWithScale(value)
															return (
																<g key={i}>
																	<line
																		x1="60"
																		y1={yPos}
																		x2="780"
																		y2={yPos}
																		stroke="#e5e7eb"
																		strokeWidth="1"
																		strokeDasharray="4 4"
																	/>
																	<text
																		x="55"
																		y={yPos + 4}
																		textAnchor="end"
																		fill="#6b7280"
																		fontSize="11"
																		fontFamily="system-ui"
																	>
																		{formatYLabel(value)}
																	</text>
																</g>
															)
														})}

														{/* X-axis labels */}
														{(trendData as any[]).map((data, idx) => {
												const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
												const monthLabel = data.period.split("-")[1]
												const yearLabel = data.period.split("-")[0].slice(2)

												return (
													<g key={data.period}>
														<line
															x1={xPos}
															y1="20"
															x2={xPos}
															y2="260"
															stroke="#e5e7eb"
															strokeWidth="1"
															strokeDasharray="4 4"
															opacity={idx === 0 || idx === trendData.length - 1 ? 0 : 1}
														/>
														<text
															x={xPos}
															y="275"
															textAnchor="middle"
															fill="#6b7280"
															fontSize="10"
															fontFamily="system-ui"
														>
															{monthLabel}/{yearLabel}
														</text>
													</g>
												)
														})}

														{/* Cumulative Submitted Volume line */}
											{(() => {
												const submittedColor = "#16a34a" // Green for submitted
												const submittedPoints = (trendData as any[])
													.map((data: any, idx: number) => {
														// Calculate cumulative submitted for this period
														let cumulativeSubmitted = 0
														if (carrierFilter === "ALL") {
															if (data.submitted?.carriers) {
																for (const value of Object.values(data.submitted.carriers)) {
																	if (value !== undefined && value !== null) {
																		cumulativeSubmitted += value as number
																	}
																}
															}
														} else {
															cumulativeSubmitted = data.submitted?.value || 0
														}

														const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
														const yPos = valueToYWithScale(cumulativeSubmitted)

														// Get cumulative active, persistency, and avg premium
									const periodSeries = (_analyticsData?.series ?? []).filter(r =>
															r.period === data.period && (carrierFilter === "ALL" || r.carrier === carrierFilter)
														)
														let totalActive = 0
														let totalInactive = 0
														let totalSubmitted = 0
														let totalPremium = 0
														let totalPlacement = 0
														let placementCount = 0
														for (const row of periodSeries) {
															totalActive += row.active || 0
															totalInactive += row.inactive || 0
															const submitted = row.submitted || 0
															totalSubmitted += submitted
															totalPremium += (row.avgPremiumSubmitted || 0) * submitted
															if ((row as any).placement !== undefined && (row as any).placement !== null) {
																totalPlacement += (row as any).placement
																placementCount++
															}
														}
														const cumulativePersistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
														const cumulativePlacement = placementCount > 0 ? totalPlacement / placementCount : 0
														const avgPremium = totalSubmitted > 0 ? totalPremium / totalSubmitted : 0

														return { x: xPos, y: yPos, value: cumulativeSubmitted, period: data.period, submitted: cumulativeSubmitted, active: totalActive, persistency: cumulativePersistency, placement: cumulativePlacement, avgPremium }
													})

												const pathData = createSmoothCurvePath(submittedPoints)

												return (
													<g key="cumulative-submitted">
														<path d={pathData} fill="none" stroke={submittedColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
														{submittedPoints.map((p: any, i: number) => (
															<circle
																key={i}
																cx={p.x}
																cy={p.y}
																r="5"
																fill={submittedColor}
																stroke="#fff"
																strokeWidth="2"
																className="cursor-pointer"
																onMouseEnter={(e) => {
																	const circle = e.currentTarget
																	const container = circle.closest(".relative")
																	if (container) {
																		const circleRect = circle.getBoundingClientRect()
																		const containerRect = container.getBoundingClientRect()
																		// Calculate position relative to the container
																		const x = circleRect.left + circleRect.width / 2 - containerRect.left
																		// Position above the point (center of circle minus height to place tooltip above)
																		const y = circleRect.top - containerRect.top - 10
																		setHoverTrendInfo({ x, y, period: p.period, value: p.submitted, carrier: "Cumulative Submitted", submitted: p.submitted, active: p.active, persistency: p.persistency, placement: p.placement, avgPremium: p.avgPremium })
																	}
																}}
																onMouseLeave={() => setHoverTrendInfo(null)}
															/>
														))}
													</g>
												)
											})()}

											{/* Cumulative Active Policies line */}
											{(() => {
												const activeColor = "#2563eb" // Blue for active
												const activePoints = (trendData as any[])
													.map((data: any, idx: number) => {
														// Calculate cumulative active for this period
														let cumulativeActive = 0
														if (carrierFilter === "ALL") {
															if (data.active?.carriers) {
																for (const value of Object.values(data.active.carriers)) {
																	if (value !== undefined && value !== null) {
																		cumulativeActive += value as number
																	}
																}
															}
														} else {
															cumulativeActive = data.active?.value || 0
														}

														const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
														const yPos = valueToYWithScale(cumulativeActive)

														// Get cumulative submitted, persistency, and avg premium
									const periodSeries = (_analyticsData?.series ?? []).filter(r =>
															r.period === data.period && (carrierFilter === "ALL" || r.carrier === carrierFilter)
														)
														let totalSubmitted = 0
														let totalActive = 0
														let totalInactive = 0
														let totalPremium = 0
														let totalPlacement = 0
														let placementCount = 0
														for (const row of periodSeries) {
															const submitted = row.submitted || 0
															totalSubmitted += submitted
															totalActive += row.active || 0
															totalInactive += row.inactive || 0
															totalPremium += (row.avgPremiumSubmitted || 0) * submitted
															if ((row as any).placement !== undefined && (row as any).placement !== null) {
																totalPlacement += (row as any).placement
																placementCount++
															}
														}
														const cumulativePersistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
														const cumulativePlacement = placementCount > 0 ? totalPlacement / placementCount : 0
														const avgPremium = totalSubmitted > 0 ? totalPremium / totalSubmitted : 0

														return { x: xPos, y: yPos, value: cumulativeActive, period: data.period, submitted: totalSubmitted, active: totalActive, persistency: cumulativePersistency, placement: cumulativePlacement, avgPremium }
													})

												const pathData = createSmoothCurvePath(activePoints)

												return (
													<g key="cumulative-active">
														<path d={pathData} fill="none" stroke={activeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />
														{activePoints.map((p: any, i: number) => (
															<circle
																key={i}
																cx={p.x}
																cy={p.y}
																r="5"
																fill={activeColor}
																stroke="#fff"
																strokeWidth="2"
																className="cursor-pointer"
																onMouseEnter={(e) => {
																	const circle = e.currentTarget
																	const container = circle.closest(".relative")
																	if (container) {
																		const circleRect = circle.getBoundingClientRect()
																		const containerRect = container.getBoundingClientRect()
																		// Calculate position relative to the container
																		const x = circleRect.left + circleRect.width / 2 - containerRect.left
																		// Position above the point (center of circle minus height to place tooltip above)
																		const y = circleRect.top - containerRect.top - 10
																		setHoverTrendInfo({ x, y, period: p.period, value: p.active, carrier: "Cumulative Active", submitted: p.submitted, active: p.active, persistency: p.persistency, placement: p.placement, avgPremium: p.avgPremium })
																	}
																}}
																onMouseLeave={() => setHoverTrendInfo(null)}
															/>
														))}
													</g>
												)
											})()}
													</>
												)
											})()}
										</svg>

										{/* Hover tooltip */}
										{hoverTrendInfo && (
											<div
												className="pointer-events-none absolute -translate-x-1/2 -translate-y-full animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10 mb-2"
												style={{ left: hoverTrendInfo.x, top: hoverTrendInfo.y }}
											>
												<div className="mb-1 text-sm font-semibold">
													{(() => {
														const monthLabel = hoverTrendInfo.period.split("-")[1]
														const yearLabel = hoverTrendInfo.period.split("-")[0]
														return `${monthLabel}/${yearLabel}`
													})()}
												</div>
												{hoverTrendInfo.carrier && (
													<div className="mb-2 text-xs text-white/80 font-semibold">{hoverTrendInfo.carrier}</div>
												)}
												{/* For "Show All": show all values */}
												{hoverTrendInfo.submitted !== undefined && (
													<div className="mb-1 text-white/90 font-semibold">
														Submitted: {numberWithCommas(Math.round(hoverTrendInfo.submitted))}
													</div>
												)}
												{hoverTrendInfo.active !== undefined && (
													<div className="mb-1 text-white/90 font-semibold">
														Active: {numberWithCommas(Math.round(hoverTrendInfo.active))}
													</div>
												)}
												{hoverTrendInfo.persistency !== undefined && (
													<div className="mb-1 text-white/90 font-semibold">
														Persistency: {((hoverTrendInfo.persistency || 0) * 100).toFixed(2)}%
													</div>
												)}
												{hoverTrendInfo.placement !== undefined && (
													<div className="mb-1 text-white/90 font-semibold">
														Placement: {((hoverTrendInfo.placement || 0) * 100).toFixed(2)}%
													</div>
												)}
												{hoverTrendInfo.avgPremium !== undefined && (
													<div className="text-white/90 font-semibold">
														Avg Premium: ${hoverTrendInfo.avgPremium.toFixed(2)}
													</div>
												)}
											</div>
										)}
									</div>

									{/* Legend for Show All - on the right side */}
									<div className="flex flex-col gap-2 ml-6 min-w-[200px]">
										<div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Metrics</div>
										<div className="flex flex-col gap-2">
											<div className="flex items-center gap-2 px-2.5 py-1.5 bg-green-50 rounded border border-green-200">
												<svg width="16" height="3" className="flex-shrink-0">
													<line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#16a34a" strokeWidth="2.5" />
												</svg>
												<span className="text-xs font-medium text-green-700">Submitted</span>
											</div>
											<div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 rounded border border-blue-200">
												<svg width="16" height="3" className="flex-shrink-0">
													<line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="4 2" />
												</svg>
												<span className="text-xs font-medium text-blue-700">Active</span>
											</div>
										</div>
									</div>
								</div>
								)
							}

							// Calculate min and max values for Y-axis scaling
							let minValue = Infinity
							let maxValue = -Infinity

							if (carrierFilter === "ALL") {
								// Get min/max from all carriers and cumulative
								for (const data of trendData) {
									if (data.carriers) {
										for (const value of Object.values(data.carriers)) {
											if (value !== undefined && value !== null) {
												minValue = Math.min(minValue, value as number)
												maxValue = Math.max(maxValue, value as number)
											}
										}
										// Also include cumulative value
										let cumulativeValue = 0
										if (trendMetric === "persistency") {
											// For persistency, calculate from active and inactive
								const periodSeries = (_analyticsData?.series ?? []).filter(row =>
												row.period === data.period && periods.includes(row.period)
											)
											let totalActive = 0
											let totalInactive = 0
											for (const row of periodSeries) {
												totalActive += row.active || 0
												totalInactive += row.inactive || 0
											}
											if (totalActive + totalInactive > 0) {
												cumulativeValue = totalActive / (totalActive + totalInactive)
											}
										} else {
											// For other metrics, sum all carrier values
											for (const carrierValue of Object.values(data.carriers)) {
												if (carrierValue !== undefined && carrierValue !== null) {
													cumulativeValue += carrierValue as number
												}
											}
										}
										if (cumulativeValue > 0 || trendMetric === "persistency" || trendMetric === "placement") {
											minValue = Math.min(minValue, cumulativeValue)
											maxValue = Math.max(maxValue, cumulativeValue)
										}
									}
								}
							} else {
								// Get min/max from single carrier
								for (const data of trendData) {
									if (data.value !== undefined && data.value !== null) {
										minValue = Math.min(minValue, data.value)
										maxValue = Math.max(maxValue, data.value)
									}
								}
							}

							// Handle edge cases
							if (minValue === Infinity || maxValue === -Infinity) {
								minValue = 0
								maxValue = 100
							}

							// For persistency and placement, clamp to 0-1
							if (trendMetric === "persistency" || trendMetric === "placement") {
								minValue = 0
								maxValue = 1
							} else {
								// For other metrics, always start at 0
								minValue = 0
								// Add small padding to max
								const padding = maxValue * 0.1 || 1
								maxValue = maxValue + padding
							}

							// Format Y-axis label
							const formatYLabel = (value: number): string => {
								if (trendMetric === "persistency" || trendMetric === "placement") {
									return `${Math.round(value * 100)}%`
								} else if (trendMetric === "avgprem") {
									return `$${Math.round(value)}`
								} else {
									return numberWithCommas(Math.round(value))
								}
							}

							// Get Y-axis title based on trend metric
							const getYAxisTitle = (): string => {
								if (trendMetric === "persistency") {
									return "Persistency (%)"
								} else if (trendMetric === "placement") {
									return "Placement (%)"
								} else if (trendMetric === "avgprem") {
									return "Avg Premium ($)"
								} else if (trendMetric === "submitted") {
									return "Submitted Volume"
								} else if (trendMetric === "active") {
									return "Active Policies"
								} else {
									return "Value"
								}
							}

							const chartHeight = 240
							const chartTop = 20
							const chartBottom = 260

							// Convert value to Y coordinate
							const valueToY = (value: number) => {
								if (maxValue === 0) return chartBottom
								if (trendMetric === "persistency" || trendMetric === "placement") {
									// For persistency and placement, use minValue (which is 0) and maxValue (which is 1)
									const normalized = (value - minValue) / (maxValue - minValue)
									return chartBottom - (normalized * chartHeight)
								} else {
									// For other metrics, always start from 0
									const normalized = value / maxValue
									return chartBottom - (normalized * chartHeight)
								}
							}

							return (
								<div className="flex gap-6">
									<div className="relative h-[300px] flex-1">
									<svg width="100%" height="100%" viewBox="0 0 800 300" className="overflow-visible">
										<defs>
											<linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
												<stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.1" />
												<stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.3" />
											</linearGradient>
										</defs>

										{/* Chart area */}
										<rect x="60" y="20" width="720" height="240" fill="transparent" />

										{(() => {
											// Generate scale values and use the max for consistent scaling
											const scaleValues = generateScaleValues(minValue, maxValue, 5)
											const scaleMax = scaleValues[scaleValues.length - 1]
											const valueToYWithScale = (value: number) => {
												if (scaleMax === 0) return chartBottom
												if (trendMetric === "persistency" || trendMetric === "placement") {
													// For persistency and placement, use 0-1 range
													const normalized = value / scaleMax
													return chartBottom - (normalized * chartHeight)
												} else {
													// For other metrics, always start from 0
													const normalized = value / scaleMax
													return chartBottom - (normalized * chartHeight)
												}
											}

											return (
												<>
													{/* Grid lines */}
													{scaleValues.map((value, i) => {
														const yPos = valueToYWithScale(value)
														return (
															<g key={i}>
																<line
																	x1="60"
																	y1={yPos}
																	x2="780"
																	y2={yPos}
																	stroke="#e5e7eb"
																	strokeWidth="1"
																	strokeDasharray="4 4"
																/>
																{/* Y-axis labels */}
																<text
																	x="55"
																	y={yPos + 4}
																	textAnchor="end"
																	fill="#6b7280"
																	fontSize="11"
																	fontFamily="system-ui"
																>
																	{formatYLabel(value)}
																</text>
															</g>
														)
													})}

													{/* X-axis labels and vertical grid lines */}
													{trendData.map((data: any, idx: number) => {
														const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
														const monthLabel = data.period.split("-")[1]
														const yearLabel = data.period.split("-")[0].slice(2)

														return (
												<g key={data.period}>
													<line
														x1={xPos}
														y1="20"
														x2={xPos}
														y2="260"
														stroke="#e5e7eb"
														strokeWidth="1"
														strokeDasharray="4 4"
														opacity={idx === 0 || idx === trendData.length - 1 ? 0 : 1}
													/>
													<text
														x={xPos}
														y="275"
														textAnchor="middle"
														fill="#6b7280"
														fontSize="10"
														fontFamily="system-ui"
													>
														{monthLabel}/{yearLabel}
													</text>
												</g>
											)
										})}

													{/* Y-axis title */}
													<text
														x="15"
														y="150"
														textAnchor="middle"
														fill="#6b7280"
														fontSize="12"
														fontFamily="system-ui"
														fontWeight="500"
														transform="rotate(-90 15 150)"
													>
														{getYAxisTitle()}
													</text>

													{/* X-axis title */}
													<text
														x="420"
														y="290"
														textAnchor="middle"
														fill="#6b7280"
														fontSize="12"
														fontFamily="system-ui"
														fontWeight="500"
													>
														Months
													</text>

													{/* Draw lines for each carrier */}
													{carrierFilter === "ALL" ? (
														<>
															{/* Individual carrier lines */}
															{(_analyticsData?.meta.carriers ?? []).filter(carrier => visibleCarriers.has(carrier)).map((carrier) => {
																const color = carrierColorForLabel(String(carrier))
																const points = trendData
																	.map((data: any, idx: number) => {
																		const value = data.carriers?.[carrier]
																		if (value === undefined || value === null) return null
																		const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
																		const yPos = valueToYWithScale(value)

															// Get all values for this period and carrier
									const periodRow = (_analyticsData?.series ?? []).find(r =>
																r.period === data.period && r.carrier === carrier
															)
															const submitted = periodRow?.submitted || 0
															const active = periodRow?.active || 0
															const persistency = periodRow?.persistency || 0
															const placement = (periodRow as any)?.placement || 0

															return { x: xPos, y: yPos, value, period: data.period, carrier: carrier as any, submitted, active, persistency, placement }
														})
																		.filter((p: any): p is { x: number; y: number; value: number; period: string; carrier: any; submitted: number; active: number; persistency: number; placement: number } => p !== null)

													if (points.length === 0) return null

													// Draw line
													const pathData = createSmoothCurvePath(points)

													return (
														<g key={carrier}>
															<path
																d={pathData}
																fill="none"
																stroke={color}
																strokeWidth="2.5"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
															{/* Dots on line */}
															{points.map((p: any, i: number) => (
																<circle
																	key={i}
																	cx={p.x}
																	cy={p.y}
																	r="4"
																	fill={color}
																	stroke="#fff"
																	strokeWidth="2"
																	className="cursor-pointer"
																	onMouseEnter={(e) => {
																		const circle = e.currentTarget
																		const container = circle.closest(".relative")
																		if (container) {
																			const circleRect = circle.getBoundingClientRect()
																			const containerRect = container.getBoundingClientRect()
																			// Calculate position relative to the container
																			const x = circleRect.left + circleRect.width / 2 - containerRect.left
																			// Position above the point (center of circle minus height to place tooltip above)
																			const y = circleRect.top - containerRect.top - 10
																			setHoverTrendInfo({ x, y, period: p.period, value: p.value, carrier: p.carrier, submitted: p.submitted, active: p.active, persistency: p.persistency, placement: p.placement })
																		}
																	}}
																	onMouseLeave={() => setHoverTrendInfo(null)}
																/>
															))}
														</g>
													)
												})}

												{/* Cumulative line */}
												{(() => {
													const cumulativeColor = CUMULATIVE_COLOR // Purple for cumulative
													const cumulativePoints = trendData
														.map((data: any, idx: number) => {
															let cumulativeValue = 0

															if (trendMetric === "persistency") {
																// For persistency, calculate from active and inactive
																// Filter series data for this period
									const periodSeries = (_analyticsData?.series ?? []).filter(row =>
																	row.period === data.period && periods.includes(row.period)
																)

																// Sum active and inactive across all carriers for this period
																let totalActive = 0
																let totalInactive = 0

																for (const row of periodSeries) {
																	totalActive += row.active || 0
																	totalInactive += row.inactive || 0
																}

																// Calculate persistency: active / (active + inactive)
																if (totalActive + totalInactive > 0) {
																	cumulativeValue = totalActive / (totalActive + totalInactive)
																} else {
																	cumulativeValue = 0
																}
															} else {
																// For other metrics, sum all carrier values for this period
                                                        if (data.carriers) {
                                                            const values = Object.values(data.carriers).filter(v => v !== undefined && v !== null) as number[]
                                                            if (trendMetric === "avgprem" || trendMetric === "placement") {
                                                                const count = values.length
                                                                cumulativeValue = count > 0 ? values.reduce((a, b) => a + b, 0) / count : 0
                                                            } else {
                                                                cumulativeValue = values.reduce((a, b) => a + b, 0)
                                                            }
                                                        }
															}

															const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
															const yPos = valueToYWithScale(cumulativeValue)

															// Get all cumulative values for this period
									const periodSeries = (_analyticsData?.series ?? []).filter(row =>
																row.period === data.period && periods.includes(row.period)
															)
															let totalSubmitted = 0
															let totalActive = 0
															let totalInactive = 0
															let totalPlacement = 0
															let placementCount = 0
															for (const row of periodSeries) {
																totalSubmitted += row.submitted || 0
																totalActive += row.active || 0
																totalInactive += row.inactive || 0
																if ((row as any).placement !== undefined && (row as any).placement !== null) {
																	totalPlacement += (row as any).placement
																	placementCount++
																}
															}
															const cumulativePersistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
															const cumulativePlacement = placementCount > 0 ? totalPlacement / placementCount : 0

															return { x: xPos, y: yPos, value: cumulativeValue, period: data.period, submitted: totalSubmitted, active: totalActive, persistency: cumulativePersistency, placement: cumulativePlacement }
														})
																		.filter((p: any) => p.value > 0 || trendMetric === "persistency" || trendMetric === "placement")

													if (cumulativePoints.length === 0) return null

													const pathData = createSmoothCurvePath(cumulativePoints)

													return (
														<g key="cumulative">
															<path
																d={pathData}
																fill="none"
																stroke={cumulativeColor}
																strokeWidth="3"
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeDasharray="6 4"
																opacity={0.9}
															/>
															{/* Dots on cumulative line */}
															{cumulativePoints.map((p: any, i: number) => (
																<circle
																	key={i}
																	cx={p.x}
																	cy={p.y}
																	r="5"
																	fill={cumulativeColor}
																	stroke="#fff"
																	strokeWidth="2"
																	className="cursor-pointer"
																	onMouseEnter={(e) => {
																		const circle = e.currentTarget
																		const container = circle.closest(".relative")
																		if (container) {
																			const circleRect = circle.getBoundingClientRect()
																			const containerRect = container.getBoundingClientRect()
																			// Calculate position relative to the container
																			const x = circleRect.left + circleRect.width / 2 - containerRect.left
																			// Position above the point (center of circle minus height to place tooltip above)
																			const y = circleRect.top - containerRect.top - 10
																			setHoverTrendInfo({ x, y, period: p.period, value: p.value, carrier: "Cumulative", submitted: p.submitted, active: p.active, persistency: p.persistency, placement: p.placement })
																		}
																	}}
																	onMouseLeave={() => setHoverTrendInfo(null)}
																/>
															))}
														</g>
													)
															})()}
														</>
													) : (
														// Single line for selected carrier
														(() => {
															const color = carrierColorForLabel(String(carrierFilter))
															const points = trendData
																.map((data: any, idx: number) => {
																	const value = data.value
																	const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
																	const yPos = valueToYWithScale(value)

																	// Get all values for this period and carrier
																	const periodRow = (_analyticsData?.series ?? []).find(r =>
																		r.period === data.period && r.carrier === carrierFilter
																	)
																	const submitted = periodRow?.submitted || 0
																	const active = periodRow?.active || 0
																	const persistency = periodRow?.persistency || 0
																	const placement = (periodRow as any)?.placement || 0

																	return { x: xPos, y: yPos, value, period: data.period, submitted, active, persistency, placement }
																})

															const pathData = createSmoothCurvePath(points)

															return (
																<g>
																	<path
																		d={pathData}
																		fill="none"
																		stroke={color}
																		strokeWidth="2.5"
																		strokeLinecap="round"
																		strokeLinejoin="round"
																	/>
																	{points.map((p: any, i: number) => (
																		<circle
																			key={i}
																			cx={p.x}
																			cy={p.y}
																			r="4"
																			fill={color}
																			stroke="#fff"
																			strokeWidth="2"
																			className="cursor-pointer"
																			onMouseEnter={(e) => {
																				const circle = e.currentTarget
																				const container = circle.closest(".relative")
																				if (container) {
																					const circleRect = circle.getBoundingClientRect()
																					const containerRect = container.getBoundingClientRect()
																					// Calculate position relative to the container
																					const x = circleRect.left + circleRect.width / 2 - containerRect.left
																					// Position above the point (center of circle minus height to place tooltip above)
																					const y = circleRect.top - containerRect.top - 10
																					setHoverTrendInfo({ x, y, period: p.period, value: p.value, submitted: p.submitted, active: p.active, persistency: p.persistency, placement: p.placement })
																				}
																			}}
																			onMouseLeave={() => setHoverTrendInfo(null)}
																		/>
																	))}
																</g>
															)
														})()
													)}
													</>
												)
											})()}
										</svg>

									{/* Hover tooltip */}
									{hoverTrendInfo && (
										<div
											className="pointer-events-none absolute -translate-x-1/2 -translate-y-full animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10 mb-2"
											style={{ left: hoverTrendInfo.x, top: hoverTrendInfo.y }}
										>
											<div className="mb-1 text-sm font-semibold">
												{(() => {
													const monthLabel = hoverTrendInfo.period.split("-")[1]
													const yearLabel = hoverTrendInfo.period.split("-")[0]
													return `${monthLabel}/${yearLabel}`
												})()}
											</div>
											{hoverTrendInfo.carrier && (
												<div className="mb-1 text-xs text-white/80">{hoverTrendInfo.carrier}</div>
											)}
											<div className="space-y-1">
												{(trendMetric === "all" as any) ? (
													/* For "Show All": show all values */
													<>
														{hoverTrendInfo.submitted !== undefined && (
															<div className="text-white/90 font-medium mb-1">
																Submitted: {numberWithCommas(Math.round(hoverTrendInfo.submitted))}
															</div>
														)}
														{hoverTrendInfo.active !== undefined && (
															<div className="text-white/90 font-medium mb-1">
																Active: {numberWithCommas(Math.round(hoverTrendInfo.active))}
															</div>
														)}
														{hoverTrendInfo.persistency !== undefined && (
															<div className="text-white/90 font-medium mb-1">
																Persistency: {((hoverTrendInfo.persistency || 0) * 100).toFixed(2)}%
															</div>
														)}
														{hoverTrendInfo.placement !== undefined && (
															<div className="text-white/90 font-medium mb-1">
																Placement: {((hoverTrendInfo.placement || 0) * 100).toFixed(2)}%
															</div>
														)}
														{hoverTrendInfo.avgPremium !== undefined && (
															<div className="text-white/90 font-medium">
																Avg Premium: ${hoverTrendInfo.avgPremium.toFixed(2)}
															</div>
														)}
													</>
												) : trendMetric === "persistency" ? (
													/* For persistency: only show persistency */
													<div className="text-white/90 font-medium">
														Persistency: {((hoverTrendInfo.value || 0) * 100).toFixed(2)}%
													</div>
												) : trendMetric === "placement" ? (
													/* For placement: only show placement */
													<div className="text-white/90 font-medium">
														Placement: {((hoverTrendInfo.value || 0) * 100).toFixed(2)}%
													</div>
												) : (
													/* For other metrics: show main metric value only */
													<div className="text-white/90 font-medium">
														{(() => {
															if (trendMetric === "avgprem") {
																return `Avg Premium: $${hoverTrendInfo.value.toFixed(2)}`
															} else if (trendMetric === "submitted") {
																return `Submitted: ${numberWithCommas(Math.round(hoverTrendInfo.value))}`
															} else if (trendMetric === "active") {
																return `Active: ${numberWithCommas(Math.round(hoverTrendInfo.value))}`
															} else {
																return numberWithCommas(Math.round(hoverTrendInfo.value))
															}
														})()}
													</div>
												)}
											</div>
										</div>
									)}
									</div>

									{/* Drag and Drop Legend - on the right side */}
									{carrierFilter === "ALL" && (
										<div className="flex flex-col gap-3 ml-6 min-w-[220px]">
											{/* Carriers Section - Active and Hidden */}
											<div className="flex flex-col gap-1.5">
												<div className="flex items-center justify-between">
													<div className="text-xs font-semibold text-muted-foreground uppercase">Carriers</div>
													{(() => {
														// Get all carriers that have data
														const carriersWithData = (_analyticsData?.meta.carriers ?? []).filter(carrier => {
															const hasData = trendData.some((d: any) => d.carriers && d.carriers[carrier] !== undefined)
															return hasData
														})
														// Check if all carriers with data are visible
														const allVisible = carriersWithData.length > 0 && carriersWithData.every(carrier => visibleCarriers.has(carrier))
														
														return (
															<Button
																variant="outline"
																size="sm"
																onClick={() => {
																	if (allVisible) {
																		// Hide all carriers
																		setVisibleCarriers(new Set())
																	} else {
																		// Show all carriers
																		setVisibleCarriers(new Set(carriersWithData))
																	}
																}}
																className="h-7 text-xs px-2 rounded-md"
															>
																{allVisible ? "Hide All" : "Show All"}
															</Button>
														)
													})()}
												</div>
												<div className="text-[10px] text-muted-foreground mb-1">Click to Show/Hide Carriers</div>
												<div
													className="flex flex-col gap-1.5 p-2.5 bg-muted/10 rounded-md border border-muted/50 max-h-[400px] overflow-y-auto"
													onDragOver={(e) => e.preventDefault()}
													onDrop={(e) => {
														e.preventDefault()
														// Allow dropping anywhere to toggle visibility
													}}
												>
													{/* Active Carriers */}
													{(_analyticsData?.meta.carriers ?? [])
														.filter(carrier => {
															const hasData = trendData.some((d: any) => d.carriers && d.carriers[carrier] !== undefined)
															return hasData && visibleCarriers.has(carrier)
														})
														.map((carrier) => {
															const color = carrierColorForLabel(String(carrier))
															return (
																<div
																	key={carrier}
																	draggable
																	onDragStart={() => setDraggedCarrier(carrier)}
																	onDragEnd={() => setDraggedCarrier(null)}
																	onClick={() => {
																		const newVisible = new Set(visibleCarriers)
																		newVisible.delete(carrier)
																		setVisibleCarriers(newVisible)
																	}}
																	className="flex items-center gap-2 px-2.5 py-1.5 bg-background rounded border cursor-move hover:shadow-sm transition-all"
																	style={{ borderLeft: `3px solid ${color}` }}
																>
																	<span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
																	<span className="text-xs font-medium flex-1">{carrier}</span>
																</div>
															)
														})}

													{/* Divider if there are hidden carriers */}
													{(_analyticsData?.meta.carriers ?? []).filter(carrier => {
														const hasData = trendData.some((d: any) => d.carriers && d.carriers[carrier] !== undefined)
														return hasData && !visibleCarriers.has(carrier)
													}).length > 0 && (
														<div className="border-t border-muted my-1"></div>
													)}

													{/* Hidden Carriers */}
													{(_analyticsData?.meta.carriers ?? [])
														.filter(carrier => {
															const hasData = trendData.some((d: any) => d.carriers && d.carriers[carrier] !== undefined)
															return hasData && !visibleCarriers.has(carrier)
														})
														.map((carrier) => {
															const color = carrierColorForLabel(String(carrier))
															return (
																<div
																	key={carrier}
																	draggable
																	onDragStart={() => setDraggedCarrier(carrier)}
																	onDragEnd={() => setDraggedCarrier(null)}
																	onClick={() => {
																		const newVisible = new Set(visibleCarriers)
																		newVisible.add(carrier)
																		setVisibleCarriers(newVisible)
																	}}
																	className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/30 rounded border border-muted cursor-move hover:shadow-sm transition-all opacity-50 hover:opacity-70"
																	style={{ borderLeft: `3px solid ${color}` }}
																>
																	<span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity: 0.5 }} />
																	<span className="text-xs text-muted-foreground flex-1">{carrier}</span>
																</div>
															)
														})}
												</div>
											</div>

											{/* Cumulative legend - always visible */}
											<div className="flex flex-col gap-1.5 pt-2 border-t">
												<div className="text-xs font-semibold text-muted-foreground uppercase">Always Shown</div>
												<div className="flex items-center gap-2 px-2.5 py-1.5 bg-purple-50 rounded border border-purple-200">
													<svg width="16" height="3" className="flex-shrink-0">
														<line
															x1="0"
															y1="1.5"
															x2="16"
															y2="1.5"
															stroke={CUMULATIVE_COLOR}
															strokeWidth="2.5"
															strokeDasharray="4 2"
														/>
													</svg>
													<span className="text-xs font-medium text-purple-700">Cumulative</span>
												</div>
											</div>
										</div>
									)}
								</div>
							)
						})()
					) : trendMetric !== "all" ? (
						<div className="h-[300px] w-full rounded-md border bg-muted/20 flex items-center justify-center">
							<div className="text-sm text-muted-foreground">No data available for the selected period</div>
						</div>
					) : (
						<div className="h-[300px] w-full rounded-md border bg-muted/20 flex items-center justify-center">
							<div className="text-sm text-muted-foreground">Coming soon</div>
						</div>
					)}
				</CardContent>
			</Card>
				</div>

			<Tabs defaultValue="overview" className="hidden">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="details">Details</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" />
				<TabsContent value="details" />
			</Tabs>
		</div>
		)
	)
}




