"use client"

import React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

// analytics_test_value: static data for the test analytics page
const analytics_test_value = {
  "meta": {
    "window": "all_time",
    "grain": "month",
    "as_of": "2025-10-30",
    "carriers": ["American Amicable", "Allstate", "Acme Life"],
    "include_window_slices_12": false,
    "definitions": {
      "active_count_eom": "Policies active at month end",
      "inactive_count_eom": "Policies lapsed/terminated by month end",
      "submitted_count": "Policies submitted during the calendar month",
      "avg_premium_submitted": "Average written premium of policies submitted during the month (USD)",
      "persistency_formula": "active / (active + inactive)"
    },
    "period_start": "2024-11",
    "period_end": "2025-10"
  },

  "series": [
    {"period":"2024-11","carrier":"American Amicable","active":122,"inactive":30,"submitted":82,"avg_premium_submitted":92.0,"persistency":0.8026},
    {"period":"2024-12","carrier":"American Amicable","active":123,"inactive":31,"submitted":83,"avg_premium_submitted":92.6,"persistency":0.7987},
    {"period":"2025-01","carrier":"American Amicable","active":125,"inactive":31,"submitted":83,"avg_premium_submitted":93.2,"persistency":0.8013},
    {"period":"2025-02","carrier":"American Amicable","active":128,"inactive":32,"submitted":84,"avg_premium_submitted":93.8,"persistency":0.8000},
    {"period":"2025-03","carrier":"American Amicable","active":132,"inactive":33,"submitted":86,"avg_premium_submitted":94.4,"persistency":0.8000},
    {"period":"2025-04","carrier":"American Amicable","active":134,"inactive":34,"submitted":87,"avg_premium_submitted":95.0,"persistency":0.7976},
    {"period":"2025-05","carrier":"American Amicable","active":137,"inactive":35,"submitted":89,"avg_premium_submitted":95.6,"persistency":0.7966},
    {"period":"2025-06","carrier":"American Amicable","active":140,"inactive":35,"submitted":90,"avg_premium_submitted":96.2,"persistency":0.8000},
    {"period":"2025-07","carrier":"American Amicable","active":144,"inactive":36,"submitted":92,"avg_premium_submitted":96.8,"persistency":0.8000},
    {"period":"2025-08","carrier":"American Amicable","active":146,"inactive":37,"submitted":93,"avg_premium_submitted":97.4,"persistency":0.7986},
    {"period":"2025-09","carrier":"American Amicable","active":149,"inactive":37,"submitted":95,"avg_premium_submitted":98.0,"persistency":0.8016},
    {"period":"2025-10","carrier":"American Amicable","active":152,"inactive":38,"submitted":96,"avg_premium_submitted":98.6,"persistency":0.8000},

    {"period":"2024-11","carrier":"Allstate","active":202,"inactive":50,"submitted":118,"avg_premium_submitted":106.0,"persistency":0.8016},
    {"period":"2024-12","carrier":"Allstate","active":204,"inactive":51,"submitted":121,"avg_premium_submitted":106.6,"persistency":0.8000},
    {"period":"2025-01","carrier":"Allstate","active":206,"inactive":51,"submitted":122,"avg_premium_submitted":107.2,"persistency":0.8016},
    {"period":"2025-02","carrier":"Allstate","active":208,"inactive":52,"submitted":124,"avg_premium_submitted":107.8,"persistency":0.8000},
    {"period":"2025-03","carrier":"Allstate","active":210,"inactive":53,"submitted":126,"avg_premium_submitted":108.4,"persistency":0.7985},
    {"period":"2025-04","carrier":"Allstate","active":212,"inactive":54,"submitted":127,"avg_premium_submitted":109.0,"persistency":0.7970},
    {"period":"2025-05","carrier":"Allstate","active":214,"inactive":55,"submitted":129,"avg_premium_submitted":109.6,"persistency":0.7957},
    {"period":"2025-06","carrier":"Allstate","active":216,"inactive":55,"submitted":131,"avg_premium_submitted":110.2,"persistency":0.7963},
    {"period":"2025-07","carrier":"Allstate","active":218,"inactive":56,"submitted":133,"avg_premium_submitted":110.8,"persistency":0.7956},
    {"period":"2025-08","carrier":"Allstate","active":220,"inactive":57,"submitted":135,"avg_premium_submitted":111.4,"persistency":0.7948},
    {"period":"2025-09","carrier":"Allstate","active":222,"inactive":58,"submitted":137,"avg_premium_submitted":112.0,"persistency":0.7938},
    {"period":"2025-10","carrier":"Allstate","active":224,"inactive":58,"submitted":139,"avg_premium_submitted":112.6,"persistency":0.7946},

    {"period":"2024-11","carrier":"Acme Life","active":92,"inactive":25,"submitted":61,"avg_premium_submitted":82.0,"persistency":0.7863},
    {"period":"2024-12","carrier":"Acme Life","active":93,"inactive":26,"submitted":62,"avg_premium_submitted":82.6,"persistency":0.7815},
    {"period":"2025-01","carrier":"Acme Life","active":94,"inactive":26,"submitted":64,"avg_premium_submitted":83.2,"persistency":0.7832},
    {"period":"2025-02","carrier":"Acme Life","active":95,"inactive":27,"submitted":65,"avg_premium_submitted":83.8,"persistency":0.7787},
    {"period":"2025-03","carrier":"Acme Life","active":96,"inactive":27,"submitted":67,"avg_premium_submitted":84.4,"persistency":0.7805},
    {"period":"2025-04","carrier":"Acme Life","active":97,"inactive":28,"submitted":68,"avg_premium_submitted":85.0,"persistency":0.7760},
    {"period":"2025-05","carrier":"Acme Life","active":98,"inactive":29,"submitted":70,"avg_premium_submitted":85.6,"persistency":0.7714},
    {"period":"2025-06","carrier":"Acme Life","active":99,"inactive":29,"submitted":71,"avg_premium_submitted":86.2,"persistency":0.7733},
    {"period":"2025-07","carrier":"Acme Life","active":100,"inactive":30,"submitted":73,"avg_premium_submitted":86.8,"persistency":0.7692},
    {"period":"2025-08","carrier":"Acme Life","active":101,"inactive":31,"submitted":74,"avg_premium_submitted":87.4,"persistency":0.7652},
    {"period":"2025-09","carrier":"Acme Life","active":102,"inactive":31,"submitted":76,"avg_premium_submitted":88.0,"persistency":0.7672},
    {"period":"2025-10","carrier":"Acme Life","active":103,"inactive":32,"submitted":77,"avg_premium_submitted":88.6,"persistency":0.7630}
  ],

  "windows_by_carrier": {
    "American Amicable": {
      "3m":  { "active": 447,  "inactive": 112, "submitted": 284,  "avg_premium_submitted": 98.01, "persistency": 0.7996 },
      "6m":  { "active": 868,  "inactive": 218, "submitted": 555,  "avg_premium_submitted": 97.13, "persistency": 0.7993 },
      "9m":  { "active": 1262, "inactive": 317, "submitted": 812,  "avg_premium_submitted": 96.27, "persistency": 0.7992 },
      "all_time": { "active": 1632, "inactive": 409, "submitted": 1060, "avg_premium_submitted": 95.41, "persistency": 0.7996 }
    },
    "Allstate": {
      "3m":  { "active": 666,  "inactive": 173, "submitted": 411,  "avg_premium_submitted": 112.01, "persistency": 0.7938 },
      "6m":  { "active": 1314, "inactive": 339, "submitted": 804,  "avg_premium_submitted": 111.13, "persistency": 0.7949 },
      "9m":  { "active": 1944, "inactive": 498, "submitted": 1181, "avg_premium_submitted": 110.26, "persistency": 0.7961 },
      "all_time": { "active": 2556, "inactive": 650, "submitted": 1542, "avg_premium_submitted": 109.40, "persistency": 0.7973 }
    },
    "Acme Life": {
      "3m":  { "active": 306,  "inactive": 94,  "submitted": 227,  "avg_premium_submitted": 88.01, "persistency": 0.7650 },
      "6m":  { "active": 603,  "inactive": 182, "submitted": 441,  "avg_premium_submitted": 87.13, "persistency": 0.7682 },
      "9m":  { "active": 891,  "inactive": 264, "submitted": 641,  "avg_premium_submitted": 86.28, "persistency": 0.7714 },
      "all_time": { "active": 1170, "inactive": 341, "submitted": 828,  "avg_premium_submitted": 85.45, "persistency": 0.7743 }
    }
  },

  "totals": {
    "by_carrier": [
      {"window":"all_time","carrier":"American Amicable","active":1632,"inactive":409,"submitted":1060,"avg_premium_submitted":95.41,"persistency":0.7996},
      {"window":"all_time","carrier":"Allstate","active":2556,"inactive":650,"submitted":1542,"avg_premium_submitted":109.40,"persistency":0.7973},
      {"window":"all_time","carrier":"Acme Life","active":1170,"inactive":341,"submitted":828,"avg_premium_submitted":85.45,"persistency":0.7743}
    ],
    "all": {"window":"all_time","carrier":"ALL","active":5358,"inactive":1400,"submitted":3430,"avg_premium_submitted":99.30,"persistency":0.7928}
  },

  "breakdowns_over_time": {
    "by_carrier": {
      "American Amicable": {
        "status": {
          "3m":  {"Lapsed": 78, "Terminated": 22, "Pending": 12},
          "6m":  {"Lapsed": 153, "Terminated": 44, "Pending": 21},
          "9m":  {"Lapsed": 222, "Terminated": 63, "Pending": 32},
          "all_time": {"Lapsed": 286, "Terminated": 82, "Pending": 41}
        },
        "state": {
          "3m":  [
            {"state":"CA","active":210,"inactive":54,"submitted":135,"avg_premium_submitted":99.8},
            {"state":"TX","active":126,"inactive":35,"submitted":85,"avg_premium_submitted":93.9},
            {"state":"FL","active":111,"inactive":28,"submitted":64,"avg_premium_submitted":87.5}
          ],
          "6m":  [
            {"state":"CA","active":415,"inactive":106,"submitted":270,"avg_premium_submitted":99.5},
            {"state":"TX","active":249,"inactive":70,"submitted":170,"avg_premium_submitted":93.7},
            {"state":"FL","active":204,"inactive":52,"submitted":115,"avg_premium_submitted":87.3}
          ],
          "9m":  [
            {"state":"CA","active":603,"inactive":153,"submitted":400,"avg_premium_submitted":99.1},
            {"state":"TX","active":364,"inactive":99,"submitted":250,"avg_premium_submitted":93.6},
            {"state":"FL","active":295,"inactive":75,"submitted":162,"avg_premium_submitted":87.1}
          ],
          "all_time": [
            {"state":"CA","active":823,"inactive":200,"submitted":530,"avg_premium_submitted":100.76},
            {"state":"TX","active":494,"inactive":129,"submitted":318,"avg_premium_submitted":94.04},
            {"state":"FL","active":329,"inactive":80,"submitted":212,"avg_premium_submitted":88.29}
          ]
        },
        "age_band": {
          "3m":  [
            {"age_band":"18-29","active":82,"inactive":19,"submitted":54,"avg_premium_submitted":81.9},
            {"age_band":"30-44","active":165,"inactive":40,"submitted":106,"avg_premium_submitted":91.3},
            {"age_band":"45-64","active":153,"inactive":38,"submitted":98,"avg_premium_submitted":103.8},
            {"age_band":"65+","active":47,"inactive":11,"submitted":26,"avg_premium_submitted":115.3}
          ],
          "6m":  [
            {"age_band":"18-29","active":164,"inactive":38,"submitted":106,"avg_premium_submitted":81.7},
            {"age_band":"30-44","active":329,"inactive":76,"submitted":213,"avg_premium_submitted":91.2},
            {"age_band":"45-64","active":312,"inactive":72,"submitted":194,"avg_premium_submitted":103.7},
            {"age_band":"65+","active":107,"inactive":24,"submitted":61,"avg_premium_submitted":115.2}
          ],
          "9m":  [
            {"age_band":"18-29","active":248,"inactive":57,"submitted":160,"avg_premium_submitted":81.6},
            {"age_band":"30-44","active":497,"inactive":115,"submitted":320,"avg_premium_submitted":91.2},
            {"age_band":"45-64","active":471,"inactive":109,"submitted":295,"avg_premium_submitted":103.6},
            {"age_band":"65+","active":161,"inactive":36,"submitted":98,"avg_premium_submitted":115.2}
          ],
          "all_time": [
            {"age_band":"18-29","active":296,"inactive":72,"submitted":191,"avg_premium_submitted":81.57},
            {"age_band":"30-44","active":592,"inactive":144,"submitted":382,"avg_premium_submitted":91.16},
            {"age_band":"45-64","active":560,"inactive":136,"submitted":360,"avg_premium_submitted":103.64},
            {"age_band":"65+","active":198,"inactive":47,"submitted":127,"avg_premium_submitted":115.15}
          ]
        }
      },

      "Allstate": {
        "status": {
          "3m":  {"Lapsed": 121, "Terminated": 35, "Pending": 17},
          "6m":  {"Lapsed": 237, "Terminated": 68, "Pending": 34},
          "9m":  {"Lapsed": 349, "Terminated": 100, "Pending": 49},
          "all_time": {"Lapsed": 455, "Terminated": 130, "Pending": 65}
        },
        "state": {
          "3m":  [
            {"state":"CA","active":634,"inactive":158,"submitted":391,"avg_premium_submitted":115.7},
            {"state":"TX","active":380,"inactive":93,"submitted":230,"avg_premium_submitted":108.2},
            {"state":"FL","active":259,"inactive":65,"submitted":150,"avg_premium_submitted":101.5}
          ],
          "6m":  [
            {"state":"CA","active":900,"inactive":231,"submitted":540,"avg_premium_submitted":115.5},
            {"state":"TX","active":540,"inactive":131,"submitted":335,"avg_premium_submitted":108.0},
            {"state":"FL","active":374,"inactive":100,"submitted":219,"avg_premium_submitted":101.2}
          ],
          "9m":  [
            {"state":"CA","active":1100,"inactive":282,"submitted":675,"avg_premium_submitted":115.4},
            {"state":"TX","active":660,"inactive":161,"submitted":420,"avg_premium_submitted":107.8},
            {"state":"FL","active":484,"inactive":127,"submitted":281,"avg_premium_submitted":100.9}
          ],
          "all_time": [
            {"state":"CA","active":1278,"inactive":325,"submitted":765,"avg_premium_submitted":115.44},
            {"state":"TX","active":767,"inactive":195,"submitted":467,"avg_premium_submitted":107.74},
            {"state":"FL","active":511,"inactive":130,"submitted":310,"avg_premium_submitted":101.15}
          ]
        },
        "age_band": {
          "3m":  [
            {"age_band":"18-29","active":215,"inactive":52,"submitted":132,"avg_premium_submitted":93.6},
            {"age_band":"30-44","active":435,"inactive":108,"submitted":264,"avg_premium_submitted":104.5},
            {"age_band":"45-64","active":411,"inactive":103,"submitted":247,"avg_premium_submitted":118.8},
            {"age_band":"65+","active":145,"inactive":36,"submitted":83,"avg_premium_submitted":132.1}
          ],
          "6m":  [
            {"age_band":"18-29","active":430,"inactive":104,"submitted":263,"avg_premium_submitted":93.5},
            {"age_band":"30-44","active":870,"inactive":209,"submitted":527,"avg_premium_submitted":104.4},
            {"age_band":"45-64","active":822,"inactive":206,"submitted":494,"avg_premium_submitted":118.7},
            {"age_band":"65+","active":285,"inactive":67,"submitted":154,"avg_premium_submitted":131.9}
          ],
          "9m":  [
            {"age_band":"18-29","active":665,"inactive":160,"submitted":400,"avg_premium_submitted":93.5},
            {"age_band":"30-44","active":1340,"inactive":322,"submitted":812,"avg_premium_submitted":104.4},
            {"age_band":"45-64","active":1268,"inactive":319,"submitted":765,"avg_premium_submitted":118.7},
            {"age_band":"65+","active":450,"inactive":107,"submitted":240,"avg_premium_submitted":131.9}
          ],
          "all_time": [
            {"age_band":"18-29","active":460,"inactive":119,"submitted":302,"avg_premium_submitted":93.45},
            {"age_band":"30-44","active":920,"inactive":234,"submitted":561,"avg_premium_submitted":104.44},
            {"age_band":"45-64","active":869,"inactive":221,"submitted":530,"avg_premium_submitted":118.73},
            {"age_band":"65+","active":307,"inactive":76,"submitted":163,"avg_premium_submitted":131.93}
          ]
        }
      },

      "Acme Life": {
        "status": {
          "3m":  {"Lapsed": 66, "Terminated": 19, "Pending": 9},
          "6m":  {"Lapsed": 127, "Terminated": 36, "Pending": 19},
          "9m":  {"Lapsed": 185, "Terminated": 53, "Pending": 26},
          "all_time": {"Lapsed": 239, "Terminated": 68, "Pending": 34}
        },
        "state": {
          "3m":  [
            {"state":"CA","active":150,"inactive":43,"submitted":100,"avg_premium_submitted":90.3},
            {"state":"TX","active":89,"inactive":25,"submitted":60,"avg_premium_submitted":84.2},
            {"state":"FL","active":67,"inactive":19,"submitted":43,"avg_premium_submitted":77.5}
          ],
          "6m":  [
            {"state":"CA","active":299,"inactive":85,"submitted":201,"avg_premium_submitted":90.2},
            {"state":"TX","active":178,"inactive":49,"submitted":120,"avg_premium_submitted":84.2},
            {"state":"FL","active":134,"inactive":38,"submitted":80,"avg_premium_submitted":77.4}
          ],
          "9m":  [
            {"state":"CA","active":434,"inactive":123,"submitted":302,"avg_premium_submitted":90.2},
            {"state":"TX","active":259,"inactive":73,"submitted":182,"avg_premium_submitted":84.2},
            {"state":"FL","active":197,"inactive":55,"submitted":117,"avg_premium_submitted":77.4}
          ],
          "all_time": [
            {"state":"CA","active":569,"inactive":161,"submitted":402,"avg_premium_submitted":90.2},
            {"state":"TX","active":341,"inactive":97,"submitted":241,"avg_premium_submitted":84.19},
            {"state":"FL","active":228,"inactive":64,"submitted":158,"avg_premium_submitted":77.41}
          ]
        },
        "age_band": {
          "3m":  [
            {"age_band":"18-29","active":60,"inactive":18,"submitted":40,"avg_premium_submitted":73.1},
            {"age_band":"30-44","active":121,"inactive":34,"submitted":78,"avg_premium_submitted":85.7},
            {"age_band":"45-64","active":115,"inactive":32,"submitted":74,"avg_premium_submitted":96.4},
            {"age_band":"65+","active":40,"inactive":10,"submitted":35,"avg_premium_submitted":103.1}
          ],
          "6m":  [
            {"age_band":"18-29","active":120,"inactive":34,"submitted":80,"avg_premium_submitted":73.1},
            {"age_band":"30-44","active":240,"inactive":68,"submitted":156,"avg_premium_submitted":85.6},
            {"age_band":"45-64","active":230,"inactive":66,"submitted":148,"avg_premium_submitted":96.3},
            {"age_band":"65+","active":80,"inactive":20,"submitted":70,"avg_premium_submitted":103.1}
          ],
          "9m":  [
            {"age_band":"18-29","active":180,"inactive":52,"submitted":120,"avg_premium_submitted":73.1},
            {"age_band":"30-44","active":360,"inactive":102,"submitted":234,"avg_premium_submitted":85.6},
            {"age_band":"45-64","active":345,"inactive":98,"submitted":222,"avg_premium_submitted":96.3},
            {"age_band":"65+","active":120,"inactive":33,"submitted":90,"avg_premium_submitted":103.1}
          ],
          "all_time": [
            {"age_band":"18-29","active":205,"inactive":56,"submitted":122,"avg_premium_submitted":73.03},
            {"age_band":"30-44","active":410,"inactive":116,"submitted":287,"avg_premium_submitted":85.61},
            {"age_band":"45-64","active":387,"inactive":110,"submitted":272,"avg_premium_submitted":96.32},
            {"age_band":"65+","active":136,"inactive":40,"submitted":120,"avg_premium_submitted":103.09}
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

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = (angleDeg - 90) * (Math.PI / 180)
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
	const start = polarToCartesian(cx, cy, r, endAngle)
	const end = polarToCartesian(cx, cy, r, startAngle)
	const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
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

type AnalyticsTestValue = typeof analytics_test_value

export default function AnalyticsTestPage() {
	const [groupBy, setGroupBy] = React.useState("carrier")
	const [trendMetric, setTrendMetric] = React.useState("persistency")
	const [timeWindow, setTimeWindow] = React.useState<"3" | "6" | "9" | "all">("3")
	const [carrierFilter, setCarrierFilter] = React.useState<string>("ALL")
	const [selectedCarrier, setSelectedCarrier] = React.useState<string | null>(null)
	const [hoverInfo, setHoverInfo] = React.useState<null | { x: number; y: number; label: string; submitted: number; sharePct: number; persistencyPct: number; active: number }>(null)
	const [hoverStatusInfo, setHoverStatusInfo] = React.useState<null | { x: number; y: number; status: string; count: number; pct: number }>(null)
	const [hoverBreakdownInfo, setHoverBreakdownInfo] = React.useState<null | { x: number; y: number; label: string; value: number; pct: number }>(null)
	const [hoverPersistencyInfo, setHoverPersistencyInfo] = React.useState<null | { x: number; y: number; label: string; count: number; pct: number }>(null)
	const [hoverTrendInfo, setHoverTrendInfo] = React.useState<null | { x: number; y: number; period: string; value: number; carrier?: string; submitted?: number; active?: number; persistency?: number; avgPremium?: number }>(null)

	const [_analyticsData, setAnalyticsData] = React.useState<AnalyticsTestValue | null>(null)
	React.useEffect(() => {
		let isMounted = true
		;(async () => {
			try {
                console.log('hello gindha')
				const supabase = createClient()
				const { data: auth } = await supabase.auth.getUser()
				const userId = auth?.user?.id
				if (!userId) return
                console.log("userId", userId)

				const { data: userRow, error: userError } = await supabase
					.from("users")
					.select("agency_id")
					.eq("auth_user_id", userId)
					.single()
				if (userError || !userRow?.agency_id) return
                console.log("userRow", userRow)

				const { data: rpcData, error: rpcError } = await supabase
					.rpc("get_analytics_from_deals_with_agency_id", { p_agency_id: userRow.agency_id })
				if (rpcError || !rpcData) return

                console.log("rpcData", rpcData)
                console.log("rpcError", rpcError)
                console.log("userRow", userRow)
                console.log("agency_id", userRow.agency_id)

				if (isMounted) setAnalyticsData(rpcData as AnalyticsTestValue)
			} catch (_) {
				// swallow for now; can add toast/logging later
			}
		})()
		return () => { isMounted = false }
	}, [])

	const isLoading = !_analyticsData
	const analyticsData = _analyticsData as AnalyticsTestValue | null

	const carriers = React.useMemo(() => ["ALL", ...(_analyticsData?.meta.carriers ?? [])], [_analyticsData])

	const n: number | "all" = timeWindow === "all" ? "all" : Number(timeWindow)
	const periods = React.useMemo(() => {
		if (!_analyticsData) return [] as string[]
		return getLastNPeriods(_analyticsData.series, _analyticsData.meta.period_end, n)
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
		
		for (const row of (_analyticsData?.series ?? [])) {
			if (!periods.includes(row.period)) continue
			if (carrierFilter !== "ALL" && row.carrier !== carrierFilter) continue
			totalActive += row.active || 0
			totalInactive += row.inactive || 0
			totalSubmittedValue += row.submitted || 0
		}
		
		const persistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
		
		return {
			persistency: persistency,
			submitted: totalSubmittedValue,
			active: totalActive,
		}
	}, [periods, carrierFilter])

	const palette = ["#16a34a", "#2563eb", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6"]

	const wedges = React.useMemo(() => {
		let cursor = 0
		return (_analyticsData?.meta.carriers ?? [])
			.map((label, idx) => ({
				label,
				value: byCarrierAgg[label].submitted,
				color: palette[idx % palette.length],
			}))
			.filter((w) => w.value > 0)
			.map((w) => {
				const pct = totalSubmitted > 0 ? w.value / totalSubmitted : 0
				const ang = pct * 360
				const piece = { ...w, start: cursor, end: cursor + ang, pct: Math.round(pct * 1000) / 10 }
				cursor += ang
				return piece
			})
	}, [byCarrierAgg, totalSubmitted])

	// Determine if we should show detail view
	const detailCarrier = React.useMemo(() => {
		if (selectedCarrier) return selectedCarrier
		if (carrierFilter !== "ALL" && groupBy === "carrier") return carrierFilter
		return null
	}, [selectedCarrier, carrierFilter, groupBy])

	// Helper to get window key
	const windowKey = React.useMemo(() => timeWindow === "all" ? "all_time" : `${timeWindow}m` as "3m" | "6m" | "9m" | "all_time", [timeWindow])

	// Status breakdown for detail view (when groupBy === "carrier")
	const statusBreakdown = React.useMemo(() => {
		if (!detailCarrier || groupBy !== "carrier") return null
		const byCarrier = _analyticsData?.breakdowns_over_time?.by_carrier
		if (!byCarrier || !(detailCarrier in byCarrier)) return null
		const carrierData = byCarrier[detailCarrier as keyof typeof byCarrier]?.status?.[windowKey]
		if (!carrierData) return null

		const statusColors: Record<string, string> = {
			Lapsed: "#f97316",           // Vibrant orange
			"Not Taken": "#eab308",      // Bright yellow/gold
			Withdrawn: "#6366f1",        // Indigo
			Other: "#8b5cf6",           // Purple
			Terminated: "#dc2626",      // Deep red
			Pending: "#06b6d4",         // Cyan/teal
		}

		// Only include statuses that exist in the breakdowns_status_over_time data for this carrier
		const entries: { status: string; count: number; color: string }[] = []
		
		// Add statuses from breakdowns_status_over_time - only if they exist as keys in carrierData
		Object.keys(carrierData).forEach((status) => {
			const count = carrierData[status as keyof typeof carrierData] as number | undefined
			if (count !== undefined && count >= 0) {
				entries.push({
					status,
					count,
					color: statusColors[status] || "#6b7280",
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
			CA: "#3b82f6",  // Blue
			TX: "#10b981",  // Green
			FL: "#f59e0b",  // Orange
			NY: "#8b5cf6",  // Purple
			AZ: "#ef4444",  // Red
		}

		const entries: { label: string; value: number; color: string }[] = []
		
		if (carrierFilter === "ALL") {
			// Sum across all carriers
			const stateTotals: Record<string, { submitted: number }> = {}
			
			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				const byCarrier = _analyticsData?.breakdowns_over_time?.by_carrier
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
					entries.push({
						label: state,
						value: data.submitted,
						color: stateColors[state] || "#6b7280",
					})
				}
			})
		} else {
			// Single carrier
			const byCarrier = _analyticsData?.breakdowns_over_time?.by_carrier
			if (!byCarrier || !(carrierFilter in byCarrier)) return null
			const carrierData = byCarrier[carrierFilter as keyof typeof byCarrier]
			if (!carrierData) return null
			const stateData = carrierData.state?.[windowKey]
			if (!stateData) return null
			
			stateData.forEach((entry: { state: string; submitted: number }) => {
				if (entry.submitted > 0) {
					entries.push({
						label: entry.state,
						value: entry.submitted,
						color: stateColors[entry.state] || "#6b7280",
					})
				}
			})
		}

		const total = entries.reduce((sum, e) => sum + e.value, 0)
		
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

		return { wedges, total }
	}, [carrierFilter, windowKey, groupBy])

	// Age breakdown for detail view (when groupBy === "age")
	const ageBreakdown = React.useMemo(() => {
		if (groupBy !== "age") return null
		
		const ageColors: Record<string, string> = {
			"18-29": "#10b981",  // Green
			"30-44": "#3b82f6",  // Blue
			"45-64": "#f59e0b",  // Orange
			"65+": "#8b5cf6",    // Purple
		}

		const entries: { label: string; value: number; color: string }[] = []
		
		if (carrierFilter === "ALL") {
			// Sum across all carriers
			const ageTotals: Record<string, { submitted: number }> = {}
			
			for (const carrier of (_analyticsData?.meta.carriers ?? [])) {
				const byCarrier = _analyticsData?.breakdowns_over_time?.by_carrier
				if (!byCarrier || !(carrier in byCarrier)) continue
				const carrierData = byCarrier[carrier as keyof typeof byCarrier]
				if (!carrierData) continue
				const ageData = carrierData.age_band?.[windowKey]
				if (!ageData) continue
				
				for (const ageEntry of ageData) {
					if (!ageTotals[ageEntry.age_band]) {
						ageTotals[ageEntry.age_band] = { submitted: 0 }
					}
					ageTotals[ageEntry.age_band].submitted += ageEntry.submitted
				}
			}
			
			Object.entries(ageTotals).forEach(([ageBand, data]) => {
				if (data.submitted > 0) {
					entries.push({
						label: ageBand,
						value: data.submitted,
						color: ageColors[ageBand] || "#6b7280",
					})
				}
			})
		} else {
			// Single carrier
			const byCarrier = _analyticsData?.breakdowns_over_time?.by_carrier
			if (!byCarrier || !(carrierFilter in byCarrier)) return null
			const carrierData = byCarrier[carrierFilter as keyof typeof byCarrier]
			if (!carrierData) return null
			const ageData = carrierData.age_band?.[windowKey]
			if (!ageData) return null
			
			ageData.forEach((entry: { age_band: string; submitted: number }) => {
				if (entry.submitted > 0) {
					entries.push({
						label: entry.age_band,
						value: entry.submitted,
						color: ageColors[entry.age_band] || "#6b7280",
					})
				}
			})
		}

		const total = entries.reduce((sum, e) => sum + e.value, 0)
		
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

		return { wedges, total }
	}, [carrierFilter, windowKey, groupBy])

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
				const windowsByCarrier = _analyticsData?.windows_by_carrier
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
			const windowsByCarrier = _analyticsData?.windows_by_carrier
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
		].filter(e => e.count > 0)

		const total = active + inactive
		
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
		})

		return { wedges, total, active, inactive }
	}, [carrierFilter, windowKey, groupBy])

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
		const getValue = (row: { persistency: number; submitted: number; active: number; avg_premium_submitted: number }) => {
			switch (trendMetric) {
				case "persistency":
					return row.persistency
				case "submitted":
					return row.submitted
				case "active":
					return row.active
				case "avgprem":
					return row.avg_premium_submitted
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

	return (
		isLoading ? (
			<div className="flex min-h-screen w-full items-center justify-center p-6">
				<div className="text-sm text-muted-foreground">Loading analytics…</div>
			</div>
		) : (
			<div className="flex w-full flex-col gap-6 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-semibold">Agency Analytics</h1>

				<div className="flex items-center gap-3">
					{/* Time window: 3,6,9,All Time */}
					<Select value={timeWindow} onValueChange={(v) => setTimeWindow(v as any)}>
						<SelectTrigger className="w-[140px]"><SelectValue placeholder="3 Months" /></SelectTrigger>
						<SelectContent>
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
						<SelectTrigger className="w-[200px]"><SelectValue placeholder="All Carriers" /></SelectTrigger>
						<SelectContent>
							{carriers.map((c) => (
								<SelectItem key={c} value={c}>{c === "ALL" ? "All Carriers" : c}</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Downlines: single option for now */}
					<Select value="all" onValueChange={() => {}}>
						<SelectTrigger className="w-[160px]"><SelectValue placeholder="All Downlines" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Downlines</SelectItem>
						</SelectContent>
					</Select>

					<Button variant="blue">Upload Reports</Button>
				</div>
			</div>

			{/* KPI tiles centered to middle 1/3rd */}
			<div className="flex w-full justify-center">
				<div className="grid w-full max-w-3xl grid-cols-3 gap-3">
					<Card>
						<CardContent className="p-4">
							<div className="text-xs text-muted-foreground">Persistency</div>
							<div className="text-lg font-semibold">{(topStats.persistency * 100).toFixed(2)}%</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="text-xs text-muted-foreground">Submitted</div>
							<div className="text-lg font-semibold">{numberWithCommas(topStats.submitted)}</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-4">
							<div className="text-xs text-muted-foreground">Active</div>
							<div className="text-lg font-semibold">{numberWithCommas(topStats.active)}</div>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Total Submitted Business / Status Breakdown */}
			<Card>
				<CardContent className="p-4 sm:p-6">
					{(detailCarrier || groupBy === "state" || groupBy === "age" || groupBy === "persistency") ? (
						// Breakdown View (Status, State, Age, or Persistency)
						<>
							<div className="mb-4 flex items-center gap-3">
								<div className="text-xs font-medium tracking-wide text-muted-foreground">
									{groupBy === "carrier" && detailCarrier
										? `${detailCarrier === carrierFilter && carrierFilter !== "ALL" ? "COMBINED" : detailCarrier.toUpperCase()} - STATUS BREAKDOWN`
										: groupBy === "state"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY STATE`
										: groupBy === "age"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY AGE`
										: groupBy === "persistency"
										? `${carrierFilter === "ALL" ? "ALL CARRIERS" : carrierFilter.toUpperCase()} - BY PERSISTENCY`
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
									{ key: "state", label: "By State" },
									{ key: "age", label: "By Age" },
									{ key: "persistency", label: "By Persistency" },
								].map((g) => (
									<Button
										key={g.key}
										variant={groupBy === g.key ? "blue" : "outline"}
										size="sm"
										onClick={() => {
											setGroupBy(g.key)
											if (g.key !== "carrier") {
												setSelectedCarrier(null)
											}
										}}
										className="rounded-full"
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
											<circle cx={160} cy={160} r={100} fill="#fff" />
											<g filter="url(#shadow-status)">
												{statusBreakdown.wedges.map((w, idx) => {
													const path = describeDonutArc(160, 160, 150, 100, w.start, w.end)
													const mid = (w.start + w.end) / 2
													const center = polarToCartesian(160, 160, 125, mid)
													const isHovered = hoverStatusInfo?.status === w.status
													const isOtherHovered = hoverStatusInfo !== null && !isHovered

													return (
														<path
															key={w.status}
															d={path}
															fill={w.color}
															stroke="#fff"
															strokeWidth={2}
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

													return (
														<path
															key={w.label}
															d={path}
															fill={w.color}
															stroke="#fff"
															strokeWidth={2}
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
												<div className="text-white/90">
													{numberWithCommas(hoverBreakdownInfo.value)} ({hoverBreakdownInfo.pct}%)
												</div>
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
								</div>
							)}

							{/* Age Breakdown */}
							{groupBy === "age" && ageBreakdown && (
								<div className="flex flex-col items-center justify-center gap-6">
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

													return (
														<path
															key={w.label}
															d={path}
															fill={w.color}
															stroke="#fff"
															strokeWidth={2}
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
												<div className="text-white/90">
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

													return (
														<path
															key={w.label}
															d={path}
															fill={w.color}
															stroke="#fff"
															strokeWidth={2}
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
												<div className="text-white/90">
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
						</>
					) : (
						// Carrier Pie Chart View
						<>
							<div className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">TOTAL SUBMITTED BUSINESS</div>

							{/* Tabs */}
							<div className="mb-4 flex flex-wrap gap-2 justify-center">
								{[
									{ key: "carrier", label: "By Carrier" },
									{ key: "state", label: "By State" },
									{ key: "age", label: "By Age" },
									{ key: "persistency", label: "By Persistency" },
								].map((g) => (
									<Button
										key={g.key}
										variant={groupBy === g.key ? "blue" : "outline"}
										size="sm"
										onClick={() => setGroupBy(g.key)}
										className="rounded-full"
									>
										{g.label}
									</Button>
								))}
							</div>

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
										
										return (
											<path
												key={w.label}
												d={path}
												fill={w.color}
												stroke="#fff"
												strokeWidth={2}
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
									className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 duration-200 rounded-lg border border-white/10 bg-black/90 p-3 text-xs text-white shadow-lg backdrop-blur-sm z-10"
									style={{ left: hoverInfo.x, top: hoverInfo.y }}
								>
									<div className="mb-1 text-sm font-semibold">{hoverInfo.label}</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-white/80" /><span>{numberWithCommas(hoverInfo.submitted)} Total Submitted</span></div>
										<div className="text-white/90">{hoverInfo.sharePct}% of Total Business</div>
										<div className="text-white/90">{hoverInfo.persistencyPct}% Persistency Rate</div>
										<div className="text-white/90">{numberWithCommas(hoverInfo.active)} Active Policies</div>
									</div>
									<div className="mt-2 text-[10px] italic text-white/70">Click to see status breakdown</div>
								</div>
							)}
						</div>

						{/* Legend below chart */}
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
				</CardContent>
			</Card>

			{/* Performance Trends */}
			<Card>
				<CardContent className="p-4 sm:p-6">
					<div className="mb-4 text-xs font-medium tracking-wide text-muted-foreground">PERFORMANCE TRENDS</div>
					<div className="mb-4 flex flex-wrap gap-2 justify-center">
						{[
							{ key: "persistency", label: "Persistency Rate" },
							{ key: "submitted", label: "Submitted Volume" },
							{ key: "active", label: "Active Policies" },
							{ key: "avgprem", label: "Avg Premium" },
							{ key: "all", label: "Show All" },
						].map((m) => (
							<Button key={m.key} variant={trendMetric === m.key ? "blue" : "outline"} size="sm" onClick={() => setTrendMetric(m.key)} className="rounded-full">{m.label}</Button>
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
								
								const range = maxValue - minValue
								const padding = range * 0.1 || Math.abs(maxValue) * 0.1 || 1
								minValue = Math.max(0, minValue - padding)
								maxValue = maxValue + padding
								
								const chartHeight = 240
								const chartBottom = 260
								
								const valueToY = (value: number) => {
									if (maxValue === minValue) return chartBottom
									const normalized = (value - minValue) / (maxValue - minValue)
									return chartBottom - (normalized * chartHeight)
								}
								
								const formatYLabel = (value: number): string => {
									return numberWithCommas(Math.round(value))
								}
								
								return (
									<div className="relative h-[300px] w-full">
										<svg width="100%" height="100%" viewBox="0 0 800 300" className="overflow-visible">
											<defs>
												<linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
													<stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.1" />
													<stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.3" />
												</linearGradient>
											</defs>
											
											<rect x="60" y="20" width="720" height="240" fill="transparent" />
											
											{/* Grid lines */}
											{Array.from({ length: 5 }).map((_, i) => {
												const yPos = 20 + (240 / 4) * i
												const value = maxValue - ((maxValue - minValue) / 4) * i
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
														const yPos = valueToY(cumulativeSubmitted)
														
														// Get cumulative active, persistency, and avg premium
									const periodSeries = (_analyticsData?.series ?? []).filter(r => 
															r.period === data.period && (carrierFilter === "ALL" || r.carrier === carrierFilter)
														)
														let totalActive = 0
														let totalInactive = 0
														let totalSubmitted = 0
														let totalPremium = 0
														for (const row of periodSeries) {
															totalActive += row.active || 0
															totalInactive += row.inactive || 0
															const submitted = row.submitted || 0
															totalSubmitted += submitted
															totalPremium += (row.avg_premium_submitted || 0) * submitted
														}
														const cumulativePersistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
														const avgPremium = totalSubmitted > 0 ? totalPremium / totalSubmitted : 0
														
														return { x: xPos, y: yPos, value: cumulativeSubmitted, period: data.period, submitted: cumulativeSubmitted, active: totalActive, persistency: cumulativePersistency, avgPremium }
													})
												
												const pathData = submittedPoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
												
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
																		setHoverTrendInfo({ x, y, period: p.period, value: p.submitted, carrier: "Cumulative Submitted", submitted: p.submitted, active: p.active, persistency: p.persistency, avgPremium: p.avgPremium })
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
														const yPos = valueToY(cumulativeActive)
														
														// Get cumulative submitted, persistency, and avg premium
									const periodSeries = (_analyticsData?.series ?? []).filter(r => 
															r.period === data.period && (carrierFilter === "ALL" || r.carrier === carrierFilter)
														)
														let totalSubmitted = 0
														let totalActive = 0
														let totalInactive = 0
														let totalPremium = 0
														for (const row of periodSeries) {
															const submitted = row.submitted || 0
															totalSubmitted += submitted
															totalActive += row.active || 0
															totalInactive += row.inactive || 0
															totalPremium += (row.avg_premium_submitted || 0) * submitted
														}
														const cumulativePersistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
														const avgPremium = totalSubmitted > 0 ? totalPremium / totalSubmitted : 0
														
														return { x: xPos, y: yPos, value: cumulativeActive, period: data.period, submitted: totalSubmitted, active: totalActive, persistency: cumulativePersistency, avgPremium }
													})
												
												const pathData = activePoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
												
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
																		setHoverTrendInfo({ x, y, period: p.period, value: p.active, carrier: "Cumulative Active", submitted: p.submitted, active: p.active, persistency: p.persistency, avgPremium: p.avgPremium })
																	}
																}}
																onMouseLeave={() => setHoverTrendInfo(null)}
															/>
														))}
													</g>
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
												{hoverTrendInfo.avgPremium !== undefined && (
													<div className="text-white/90 font-semibold">
														Avg Premium: ${hoverTrendInfo.avgPremium.toFixed(2)}
													</div>
												)}
											</div>
										)}
										
										{/* Legend */}
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-wrap gap-4 justify-center mt-2">
											<div className="flex items-center gap-2 text-xs">
												<svg width="20" height="4" className="flex-shrink-0">
													<line x1="0" y1="2" x2="20" y2="2" stroke="#16a34a" strokeWidth="3" />
												</svg>
												<span className="text-muted-foreground">Cumulative Submitted</span>
											</div>
											<div className="flex items-center gap-2 text-xs">
												<svg width="20" height="4" className="flex-shrink-0">
													<line x1="0" y1="2" x2="20" y2="2" stroke="#2563eb" strokeWidth="3" strokeDasharray="6 4" />
												</svg>
												<span className="text-muted-foreground">Cumulative Active</span>
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
										if (cumulativeValue > 0 || trendMetric === "persistency") {
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

							// Add padding to the range (10% on each side)
							const range = maxValue - minValue
							const padding = range * 0.1 || Math.abs(maxValue) * 0.1 || 1
							minValue = Math.max(0, minValue - padding)
							maxValue = maxValue + padding

							// For persistency, clamp to 0-1
							if (trendMetric === "persistency") {
								minValue = 0
								maxValue = 1
							}

							// Format Y-axis label
							const formatYLabel = (value: number): string => {
								if (trendMetric === "persistency") {
									return `${Math.round(value * 100)}%`
								} else if (trendMetric === "avgprem") {
									return `$${Math.round(value)}`
								} else {
									return numberWithCommas(Math.round(value))
								}
							}

							const chartHeight = 240
							const chartTop = 20
							const chartBottom = 260

							// Convert value to Y coordinate
							const valueToY = (value: number) => {
								if (maxValue === minValue) return chartBottom
								const normalized = (value - minValue) / (maxValue - minValue)
								return chartBottom - (normalized * chartHeight)
							}

							return (
								<div className="relative h-[300px] w-full">
									<svg width="100%" height="100%" viewBox="0 0 800 300" className="overflow-visible">
										<defs>
											<linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
												<stop offset="0%" stopColor="#e5e7eb" stopOpacity="0.1" />
												<stop offset="100%" stopColor="#e5e7eb" stopOpacity="0.3" />
											</linearGradient>
										</defs>
										
										{/* Chart area */}
										<rect x="60" y="20" width="720" height="240" fill="transparent" />
										
										{/* Grid lines */}
										{Array.from({ length: 5 }).map((_, i) => {
											const yPos = 20 + (240 / 4) * i
											const value = maxValue - ((maxValue - minValue) / 4) * i
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
										
										{/* Draw lines for each carrier */}
										{carrierFilter === "ALL" ? (
											<>
												{/* Individual carrier lines */}
								{(_analyticsData?.meta.carriers ?? []).map((carrier, carrierIdx) => {
													const palette = ["#16a34a", "#2563eb", "#f59e0b"]
													const color = palette[carrierIdx % palette.length]
													const points = trendData
														.map((data: any, idx: number) => {
															const value = data.carriers?.[carrier]
															if (value === undefined || value === null) return null
															const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
															const yPos = valueToY(value)
															
															// Get all values for this period and carrier
									const periodRow = (_analyticsData?.series ?? []).find(r => 
																r.period === data.period && r.carrier === carrier
															)
															const submitted = periodRow?.submitted || 0
															const active = periodRow?.active || 0
															const persistency = periodRow?.persistency || 0
															
															return { x: xPos, y: yPos, value, period: data.period, carrier: carrier as any, submitted, active, persistency }
														})
														.filter((p: any): p is { x: number; y: number; value: number; period: string; carrier: any; submitted: number; active: number; persistency: number } => p !== null)
													
													if (points.length === 0) return null
													
													// Draw line
													const pathData = points
														.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
														.join(" ")
													
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
																			setHoverTrendInfo({ x, y, period: p.period, value: p.value, carrier: p.carrier, submitted: p.submitted, active: p.active, persistency: p.persistency })
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
													const cumulativeColor = "#8b5cf6" // Purple for cumulative
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
																	for (const carrierValue of Object.values(data.carriers)) {
																		if (carrierValue !== undefined && carrierValue !== null) {
																			cumulativeValue += carrierValue as number
																		}
																	}
																}
															}
															
															const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
															const yPos = valueToY(cumulativeValue)
															
															// Get all cumulative values for this period
									const periodSeries = (_analyticsData?.series ?? []).filter(row => 
																row.period === data.period && periods.includes(row.period)
															)
															let totalSubmitted = 0
															let totalActive = 0
															let totalInactive = 0
															for (const row of periodSeries) {
																totalSubmitted += row.submitted || 0
																totalActive += row.active || 0
																totalInactive += row.inactive || 0
															}
															const cumulativePersistency = totalActive + totalInactive > 0 ? totalActive / (totalActive + totalInactive) : 0
															
															return { x: xPos, y: yPos, value: cumulativeValue, period: data.period, submitted: totalSubmitted, active: totalActive, persistency: cumulativePersistency }
														})
														.filter((p: any) => p.value > 0 || trendMetric === "persistency")
													
													if (cumulativePoints.length === 0) return null
													
													const pathData = cumulativePoints
														.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
														.join(" ")
													
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
																			setHoverTrendInfo({ x, y, period: p.period, value: p.value, carrier: "Cumulative", submitted: p.submitted, active: p.active, persistency: p.persistency })
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
												const palette = ["#16a34a", "#2563eb", "#f59e0b"]
									const carrierIdx = (Array.isArray(_analyticsData?.meta.carriers) ? [..._analyticsData!.meta.carriers] : []).indexOf(carrierFilter as any)
												const color = carrierIdx >= 0 ? palette[carrierIdx % palette.length] : "#2563eb"
												const points = trendData
													.map((data: any, idx: number) => {
														const value = data.value
														const xPos = 60 + (720 / (trendData.length - 1 || 1)) * idx
														const yPos = valueToY(value)
														
														// Get all values for this period and carrier
									const periodRow = (_analyticsData?.series ?? []).find(r => 
															r.period === data.period && r.carrier === carrierFilter
														)
														const submitted = periodRow?.submitted || 0
														const active = periodRow?.active || 0
														const persistency = periodRow?.persistency || 0
														
														return { x: xPos, y: yPos, value, period: data.period, submitted, active, persistency }
													})
												
												const pathData = points
													.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
													.join(" ")
												
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
																		setHoverTrendInfo({ x, y, period: p.period, value: p.value, submitted: p.submitted, active: p.active, persistency: p.persistency })
																	}
																}}
																onMouseLeave={() => setHoverTrendInfo(null)}
															/>
														))}
													</g>
												)
											})()
										)}
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
												{trendMetric === "persistency" ? (
													/* For persistency: only show persistency */
													<div className="text-white/90 font-medium">
														Persistency: {((hoverTrendInfo.value || 0) * 100).toFixed(2)}%
													</div>
												) : trendMetric === "all" ? (
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
														{hoverTrendInfo.avgPremium !== undefined && (
															<div className="text-white/90 font-medium">
																Avg Premium: ${hoverTrendInfo.avgPremium.toFixed(2)}
															</div>
														)}
													</>
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
									
									{/* Legend for all carriers */}
									{carrierFilter === "ALL" && (
										<div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-wrap gap-4 justify-center mt-2">
								{(_analyticsData?.meta.carriers ?? []).map((carrier, idx) => {
												const palette = ["#16a34a", "#2563eb", "#f59e0b"]
												const color = palette[idx % palette.length]
												// Check if this carrier has data
												const hasData = trendData.some((d: any) => d.carriers && d.carriers[carrier] !== undefined)
												if (!hasData) return null
												return (
													<div key={carrier} className="flex items-center gap-2 text-xs">
														<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
														<span className="text-muted-foreground">{carrier}</span>
													</div>
												)
											})}
											{/* Cumulative legend */}
											<div className="flex items-center gap-2 text-xs">
												<svg width="20" height="4" className="flex-shrink-0">
													<line
														x1="0"
														y1="2"
														x2="20"
														y2="2"
														stroke="#8b5cf6"
														strokeWidth="3"
														strokeDasharray="6 4"
													/>
												</svg>
												<span className="text-muted-foreground font-semibold">Cumulative</span>
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
  
  