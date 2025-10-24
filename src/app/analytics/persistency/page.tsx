"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { Calendar, Download, Filter, Upload } from "lucide-react"
import { useState, useEffect } from 'react'
import UploadPolicyReportsModal from '@/components/modals/upload-policy-reports-modal'
import { createClient } from '@/lib/supabase/client'

/**
 * Retrieves the agency ID for the current user
 *
 * @param supabase - Supabase client instance
 * @param userId - The authenticated user's ID (auth_user_id)
 * @returns Promise<string> - The agency ID
 */
async function getAgencyId(supabase: any, userId: string): Promise<string> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('agency_id')
      .eq('auth_user_id', userId)
      .single()

    if (error || !user) {
      throw new Error('Failed to fetch user agency')
    }

    if (!user.agency_id) {
      throw new Error('User is not associated with an agency')
    }

    return user.agency_id
  } catch (error) {
    console.error('Error fetching agency ID:', error)
    throw error instanceof Error ? error : new Error('Failed to retrieve agency ID')
  }
}

// // Persistency data structure - fallback data for when RPC fails
// const PERSISTENCY_DATA = {
//   "carriers": [
//     {
//       "carrier": "Aetna",
//       "timeRanges": {
//         "3": {
//           "negativeCount": 314,
//           "positiveCount": 269,
//           "negativePercentage": 53.86,
//           "positivePercentage": 46.14
//         },
//         "6": {
//           "negativeCount": 1757,
//           "positiveCount": 841,
//           "negativePercentage": 67.63,
//           "positivePercentage": 32.37
//         },
//         "9": {
//           "negativeCount": 2925,
//           "positiveCount": 1227,
//           "negativePercentage": 70.45,
//           "positivePercentage": 29.55
//         },
//         "All": {
//           "negativeCount": 5788,
//           "positiveCount": 2208,
//           "negativePercentage": 72.39,
//           "positivePercentage": 27.61
//         }
//       },
//       "totalPolicies": 13574,
//       "persistencyRate": 27.61,
//       "statusBreakdowns": {
//         "3": {
//           "Other": {
//             "count": 44,
//             "percentage": 4.4
//           },
//           "Active": {
//             "count": 269,
//             "percentage": 26.87
//           },
//           "Closed": {
//             "count": 49,
//             "percentage": 4.9
//           },
//           "Lapsed": {
//             "count": 177,
//             "percentage": 17.68
//           },
//           "Decline": {
//             "count": 315,
//             "percentage": 31.47
//           },
//           "Pending": {
//             "count": 33,
//             "percentage": 3.3
//           },
//           "Withdrawn": {
//             "count": 64,
//             "percentage": 6.39
//           },
//           "Issued Not In Force": {
//             "count": 50,
//             "percentage": 5
//           }
//         },
//         "6": {
//           "Other": {
//             "count": 84,
//             "percentage": 2.18
//           },
//           "Active": {
//             "count": 841,
//             "percentage": 21.8
//           },
//           "Closed": {
//             "count": 219,
//             "percentage": 5.68
//           },
//           "Lapsed": {
//             "count": 1112,
//             "percentage": 28.83
//           },
//           "Decline": {
//             "count": 1080,
//             "percentage": 28
//           },
//           "Not Taken": {
//             "count": 95,
//             "percentage": 2.46
//           },
//           "Withdrawn": {
//             "count": 269,
//             "percentage": 6.97
//           },
//           "Terminated": {
//             "count": 157,
//             "percentage": 4.07
//           }
//         },
//         "9": {
//           "Other": {
//             "count": 88,
//             "percentage": 1.42
//           },
//           "Active": {
//             "count": 1224,
//             "percentage": 19.7
//           },
//           "Closed": {
//             "count": 336,
//             "percentage": 5.41
//           },
//           "Lapsed": {
//             "count": 1931,
//             "percentage": 31.08
//           },
//           "Decline": {
//             "count": 1774,
//             "percentage": 28.55
//           },
//           "Not Taken": {
//             "count": 202,
//             "percentage": 3.25
//           },
//           "Withdrawn": {
//             "count": 448,
//             "percentage": 7.21
//           },
//           "Terminated": {
//             "count": 210,
//             "percentage": 3.38
//           }
//         },
//         "All": {
//           "Other": {
//             "count": 333,
//             "percentage": 2.45
//           },
//           "Active": {
//             "count": 2199,
//             "percentage": 16.2
//           },
//           "Closed": {
//             "count": 690,
//             "percentage": 5.08
//           },
//           "Lapsed": {
//             "count": 3906,
//             "percentage": 28.78
//           },
//           "Decline": {
//             "count": 4583,
//             "percentage": 33.76
//           },
//           "Not Taken": {
//             "count": 675,
//             "percentage": 4.97
//           },
//           "Withdrawn": {
//             "count": 737,
//             "percentage": 5.43
//           },
//           "Terminated": {
//             "count": 451,
//             "percentage": 3.32
//           }
//         }
//       }
//     },
//     {
//       "carrier": "Aflac",
//       "timeRanges": {
//         "3": {
//           "negativeCount": 280,
//           "positiveCount": 226,
//           "negativePercentage": 55.34,
//           "positivePercentage": 44.66
//         },
//         "6": {
//           "negativeCount": 1595,
//           "positiveCount": 762,
//           "negativePercentage": 67.67,
//           "positivePercentage": 32.33
//         },
//         "9": {
//           "negativeCount": 3477,
//           "positiveCount": 1318,
//           "negativePercentage": 72.51,
//           "positivePercentage": 27.49
//         },
//         "All": {
//           "negativeCount": 8112,
//           "positiveCount": 2737,
//           "negativePercentage": 74.77,
//           "positivePercentage": 25.23
//         }
//       },
//       "totalPolicies": 16823,
//       "persistencyRate": 25.23,
//       "statusBreakdowns": {
//         "3": {
//           "Other": {
//             "count": 38,
//             "percentage": 4.39
//           },
//           "Active": {
//             "count": 226,
//             "percentage": 26.13
//           },
//           "Closed": {
//             "count": 41,
//             "percentage": 4.74
//           },
//           "Lapsed": {
//             "count": 150,
//             "percentage": 17.34
//           },
//           "Decline": {
//             "count": 254,
//             "percentage": 29.36
//           },
//           "Not Taken": {
//             "count": 27,
//             "percentage": 3.12
//           },
//           "Withdrawn": {
//             "count": 68,
//             "percentage": 7.86
//           },
//           "Issued Not In Force": {
//             "count": 61,
//             "percentage": 7.05
//           }
//         },
//         "6": {
//           "Other": {
//             "count": 81,
//             "percentage": 2.39
//           },
//           "Active": {
//             "count": 761,
//             "percentage": 22.47
//           },
//           "Closed": {
//             "count": 173,
//             "percentage": 5.11
//           },
//           "Lapsed": {
//             "count": 1046,
//             "percentage": 30.89
//           },
//           "Decline": {
//             "count": 840,
//             "percentage": 24.81
//           },
//           "Not Taken": {
//             "count": 109,
//             "percentage": 3.22
//           },
//           "Withdrawn": {
//             "count": 258,
//             "percentage": 7.62
//           },
//           "Terminated": {
//             "count": 118,
//             "percentage": 3.48
//           }
//         },
//         "9": {
//           "Other": {
//             "count": 81,
//             "percentage": 1.17
//           },
//           "Active": {
//             "count": 1317,
//             "percentage": 19.09
//           },
//           "Closed": {
//             "count": 353,
//             "percentage": 5.12
//           },
//           "Lapsed": {
//             "count": 2406,
//             "percentage": 34.88
//           },
//           "Decline": {
//             "count": 1752,
//             "percentage": 25.4
//           },
//           "Not Taken": {
//             "count": 271,
//             "percentage": 3.93
//           },
//           "Withdrawn": {
//             "count": 493,
//             "percentage": 7.15
//           },
//           "Terminated": {
//             "count": 225,
//             "percentage": 3.26
//           }
//         },
//         "All": {
//           "Other": {
//             "count": 465,
//             "percentage": 2.76
//           },
//           "Active": {
//             "count": 2731,
//             "percentage": 16.23
//           },
//           "Closed": {
//             "count": 907,
//             "percentage": 5.39
//           },
//           "Lapsed": {
//             "count": 5569,
//             "percentage": 33.1
//           },
//           "Decline": {
//             "count": 4379,
//             "percentage": 26.03
//           },
//           "Not Taken": {
//             "count": 1138,
//             "percentage": 6.76
//           },
//           "Withdrawn": {
//             "count": 1113,
//             "percentage": 6.62
//           },
//           "Terminated": {
//             "count": 521,
//             "percentage": 3.1
//           }
//         }
//       }
//     },
//     {
//       "carrier": "American Amicable / Occidental",
//       "timeRanges": {
//         "3": {
//           "negativeCount": 554,
//           "positiveCount": 160,
//           "negativePercentage": 77.59,
//           "positivePercentage": 22.41
//         },
//         "6": {
//           "negativeCount": 2203,
//           "positiveCount": 514,
//           "negativePercentage": 81.08,
//           "positivePercentage": 18.92
//         },
//         "9": {
//           "negativeCount": 3462,
//           "positiveCount": 729,
//           "negativePercentage": 82.61,
//           "positivePercentage": 17.39
//         },
//         "All": {
//           "negativeCount": 5819,
//           "positiveCount": 1278,
//           "negativePercentage": 81.99,
//           "positivePercentage": 18.01
//         }
//       },
//       "totalPolicies": 7097,
//       "persistencyRate": 18.01,
//       "statusBreakdowns": {
//         "3": {
//           "Other": {
//             "count": 78,
//             "percentage": 10.92
//           },
//           "Active": {
//             "count": 160,
//             "percentage": 22.41
//           },
//           "Declined": {
//             "count": 205,
//             "percentage": 28.71
//           },
//           "NotTaken": {
//             "count": 75,
//             "percentage": 10.5
//           },
//           "Withdrawn": {
//             "count": 71,
//             "percentage": 9.94
//           },
//           "IssNotPaid": {
//             "count": 33,
//             "percentage": 4.62
//           },
//           "Act-Pastdue": {
//             "count": 36,
//             "percentage": 5.04
//           },
//           "InfNotTaken": {
//             "count": 56,
//             "percentage": 7.84
//           }
//         },
//         "6": {
//           "Other": {
//             "count": 164,
//             "percentage": 6.04
//           },
//           "Active": {
//             "count": 514,
//             "percentage": 18.92
//           },
//           "Declined": {
//             "count": 744,
//             "percentage": 27.38
//           },
//           "NotTaken": {
//             "count": 304,
//             "percentage": 11.19
//           },
//           "Withdrawn": {
//             "count": 274,
//             "percentage": 10.08
//           },
//           "Incomplete": {
//             "count": 163,
//             "percentage": 6
//           },
//           "Terminated": {
//             "count": 109,
//             "percentage": 4.01
//           },
//           "InfNotTaken": {
//             "count": 445,
//             "percentage": 16.38
//           }
//         },
//         "9": {
//           "Other": {
//             "count": 187,
//             "percentage": 4.46
//           },
//           "Active": {
//             "count": 728,
//             "percentage": 17.37
//           },
//           "Declined": {
//             "count": 1093,
//             "percentage": 26.08
//           },
//           "NotTaken": {
//             "count": 489,
//             "percentage": 11.67
//           },
//           "Withdrawn": {
//             "count": 421,
//             "percentage": 10.05
//           },
//           "Incomplete": {
//             "count": 245,
//             "percentage": 5.85
//           },
//           "Terminated": {
//             "count": 253,
//             "percentage": 6.04
//           },
//           "InfNotTaken": {
//             "count": 775,
//             "percentage": 18.49
//           }
//         },
//         "All": {
//           "Other": {
//             "count": 274,
//             "percentage": 3.86
//           },
//           "Active": {
//             "count": 1270,
//             "percentage": 17.89
//           },
//           "Declined": {
//             "count": 1687,
//             "percentage": 23.77
//           },
//           "NotTaken": {
//             "count": 851,
//             "percentage": 11.99
//           },
//           "Withdrawn": {
//             "count": 597,
//             "percentage": 8.41
//           },
//           "Incomplete": {
//             "count": 364,
//             "percentage": 5.13
//           },
//           "Terminated": {
//             "count": 770,
//             "percentage": 10.85
//           },
//           "InfNotTaken": {
//             "count": 1284,
//             "percentage": 18.09
//           }
//         }
//       }
//     },
//     {
//       "carrier": "American Home Life Insurance Company",
//       "timeRanges": {
//         "3": {
//           "negativeCount": 4,
//           "positiveCount": 15,
//           "negativePercentage": 21.05,
//           "positivePercentage": 78.95
//         },
//         "6": {
//           "negativeCount": 5,
//           "positiveCount": 17,
//           "negativePercentage": 22.73,
//           "positivePercentage": 77.27
//         },
//         "9": {
//           "negativeCount": 19,
//           "positiveCount": 19,
//           "negativePercentage": 50,
//           "positivePercentage": 50
//         },
//         "All": {
//           "negativeCount": 361,
//           "positiveCount": 131,
//           "negativePercentage": 73.37,
//           "positivePercentage": 26.63
//         }
//       },
//       "totalPolicies": 1070,
//       "persistencyRate": 26.63,
//       "statusBreakdowns": {
//         "3": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Active": {
//             "count": 15,
//             "percentage": 44.12
//           },
//           "Lapsed": {
//             "count": 1,
//             "percentage": 2.94
//           },
//           "Decline": {
//             "count": 9,
//             "percentage": 26.47
//           },
//           "Pending": {
//             "count": 1,
//             "percentage": 2.94
//           },
//           "Not Taken": {
//             "count": 1,
//             "percentage": 2.94
//           },
//           "Withdrawn": {
//             "count": 3,
//             "percentage": 8.82
//           },
//           "Issued Not In Force": {
//             "count": 4,
//             "percentage": 11.76
//           }
//         },
//         "6": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Active": {
//             "count": 17,
//             "percentage": 35.42
//           },
//           "Lapsed": {
//             "count": 2,
//             "percentage": 4.17
//           },
//           "Decline": {
//             "count": 20,
//             "percentage": 41.67
//           },
//           "Pending": {
//             "count": 1,
//             "percentage": 2.08
//           },
//           "Not Taken": {
//             "count": 1,
//             "percentage": 2.08
//           },
//           "Withdrawn": {
//             "count": 3,
//             "percentage": 6.25
//           },
//           "Issued Not In Force": {
//             "count": 4,
//             "percentage": 8.33
//           }
//         },
//         "9": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Active": {
//             "count": 19,
//             "percentage": 22.35
//           },
//           "Lapsed": {
//             "count": 10,
//             "percentage": 11.76
//           },
//           "Decline": {
//             "count": 40,
//             "percentage": 47.06
//           },
//           "Pending": {
//             "count": 1,
//             "percentage": 1.18
//           },
//           "Not Taken": {
//             "count": 2,
//             "percentage": 2.35
//           },
//           "Withdrawn": {
//             "count": 9,
//             "percentage": 10.59
//           },
//           "Issued Not In Force": {
//             "count": 4,
//             "percentage": 4.71
//           }
//         },
//         "All": {
//           "Other": {
//             "count": 20,
//             "percentage": 1.87
//           },
//           "Active": {
//             "count": 131,
//             "percentage": 12.24
//           },
//           "Closed": {
//             "count": 20,
//             "percentage": 1.87
//           },
//           "Lapsed": {
//             "count": 249,
//             "percentage": 23.27
//           },
//           "Decline": {
//             "count": 442,
//             "percentage": 41.31
//           },
//           "Not Taken": {
//             "count": 87,
//             "percentage": 8.13
//           },
//           "Withdrawn": {
//             "count": 77,
//             "percentage": 7.2
//           },
//           "LM App Decline": {
//             "count": 44,
//             "percentage": 4.11
//           }
//         }
//       }
//     },
//     {
//       "carrier": "Combined",
//       "timeRanges": {
//         "3": {
//           "negativeCount": 2774,
//           "positiveCount": 6304,
//           "negativePercentage": 30.56,
//           "positivePercentage": 69.44
//         },
//         "6": {
//           "negativeCount": 3296,
//           "positiveCount": 6646,
//           "negativePercentage": 33.15,
//           "positivePercentage": 66.85
//         },
//         "9": {
//           "negativeCount": 3296,
//           "positiveCount": 6646,
//           "negativePercentage": 33.15,
//           "positivePercentage": 66.85
//         },
//         "All": {
//           "negativeCount": 3296,
//           "positiveCount": 6646,
//           "negativePercentage": 33.15,
//           "positivePercentage": 66.85
//         }
//       },
//       "totalPolicies": 9942,
//       "persistencyRate": 66.85,
//       "statusBreakdowns": {
//         "3": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Issued": {
//             "count": 1914,
//             "percentage": 21.08
//           },
//           "In-Force": {
//             "count": 4390,
//             "percentage": 48.36
//           },
//           "Terminated": {
//             "count": 2755,
//             "percentage": 30.35
//           },
//           "Lapse-Pending": {
//             "count": 19,
//             "percentage": 0.21
//           }
//         },
//         "6": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Issued": {
//             "count": 1923,
//             "percentage": 19.34
//           },
//           "In-Force": {
//             "count": 4723,
//             "percentage": 47.51
//           },
//           "Terminated": {
//             "count": 3270,
//             "percentage": 32.89
//           },
//           "Lapse-Pending": {
//             "count": 26,
//             "percentage": 0.26
//           }
//         },
//         "9": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Issued": {
//             "count": 1923,
//             "percentage": 19.34
//           },
//           "In-Force": {
//             "count": 4723,
//             "percentage": 47.51
//           },
//           "Terminated": {
//             "count": 3270,
//             "percentage": 32.89
//           },
//           "Lapse-Pending": {
//             "count": 26,
//             "percentage": 0.26
//           }
//         },
//         "All": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "Issued": {
//             "count": 1923,
//             "percentage": 19.34
//           },
//           "In-Force": {
//             "count": 4723,
//             "percentage": 47.51
//           },
//           "Terminated": {
//             "count": 3270,
//             "percentage": 32.89
//           },
//           "Lapse-Pending": {
//             "count": 26,
//             "percentage": 0.26
//           }
//         }
//       }
//     },
//     {
//       "carrier": "RNA",
//       "timeRanges": {
//         "3": {
//           "negativeCount": 0,
//           "positiveCount": 5,
//           "negativePercentage": 0,
//           "positivePercentage": 100
//         },
//         "6": {
//           "negativeCount": 6,
//           "positiveCount": 13,
//           "negativePercentage": 31.58,
//           "positivePercentage": 68.42
//         },
//         "9": {
//           "negativeCount": 45,
//           "positiveCount": 25,
//           "negativePercentage": 64.29,
//           "positivePercentage": 35.71
//         },
//         "All": {
//           "negativeCount": 1976,
//           "positiveCount": 384,
//           "negativePercentage": 83.73,
//           "positivePercentage": 16.27
//         }
//       },
//       "totalPolicies": 2771,
//       "persistencyRate": 16.27,
//       "statusBreakdowns": {
//         "3": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "CONTRACT ACTIVE": {
//             "count": 5,
//             "percentage": 50
//           },
//           "CON SUS HOME OFFICE": {
//             "count": 1,
//             "percentage": 10
//           },
//           "CON SUS RETURNED EFT": {
//             "count": 4,
//             "percentage": 40
//           }
//         },
//         "6": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "CON TERM LAPSED": {
//             "count": 3,
//             "percentage": 11.54
//           },
//           "CONTRACT ACTIVE": {
//             "count": 13,
//             "percentage": 50
//           },
//           "CON TERM NT NO PAY": {
//             "count": 3,
//             "percentage": 11.54
//           },
//           "CON SUS HOME OFFICE": {
//             "count": 3,
//             "percentage": 11.54
//           },
//           "CON SUS RETURNED EFT": {
//             "count": 4,
//             "percentage": 15.38
//           }
//         },
//         "9": {
//           "Other": {
//             "count": null,
//             "percentage": null
//           },
//           "CON TERM LAPSED": {
//             "count": 23,
//             "percentage": 29.87
//           },
//           "CONTRACT ACTIVE": {
//             "count": 25,
//             "percentage": 32.47
//           },
//           "CON TERM NT NO PAY": {
//             "count": 22,
//             "percentage": 28.57
//           },
//           "CON SUS HOME OFFICE": {
//             "count": 3,
//             "percentage": 3.9
//           },
//           "CON SUS RETURNED EFT": {
//             "count": 4,
//             "percentage": 5.19
//           }
//         },
//         "All": {
//           "Other": {
//             "count": 211,
//             "percentage": 7.61
//           },
//           "CON TERM LAPSED": {
//             "count": 379,
//             "percentage": 13.68
//           },
//           "CONTRACT ACTIVE": {
//             "count": 327,
//             "percentage": 11.8
//           },
//           "CON TERM DECLINED": {
//             "count": 138,
//             "percentage": 4.98
//           },
//           "CON TERM NT NO PAY": {
//             "count": 694,
//             "percentage": 25.05
//           },
//           "CON TERM WITHDRAWN": {
//             "count": 436,
//             "percentage": 15.73
//           },
//           "CON TERM INCOMPLETE": {
//             "count": 467,
//             "percentage": 16.85
//           },
//           "CON TERM NOT ISSUED": {
//             "count": 119,
//             "percentage": 4.29
//           }
//         }
//       }
//     }
//   ],
//   "overall_analytics": {
//     "timeRanges": {
//       "3": {
//         "activeCount": 6979,
//         "inactiveCount": 3926,
//         "activePercentage": 64
//       },
//       "6": {
//         "activeCount": 8793,
//         "inactiveCount": 8862,
//         "activePercentage": 49.8
//       },
//       "9": {
//         "activeCount": 9964,
//         "inactiveCount": 13224,
//         "activePercentage": 42.97
//       },
//       "All": {
//         "activeCount": 13384,
//         "inactiveCount": 25352,
//         "activePercentage": 34.55
//       }
//     },
//     "activeCount": 13384,
//     "inactiveCount": 25352,
//     "overallPersistency": 34.55
//   },
//   "carrier_comparison": {
//     "activeShareByCarrier": {
//       "RNA": 2.87,
//       "Aetna": 16.5,
//       "Aflac": 20.45,
//       "Combined": 49.66,
//       "American Amicable / Occidental": 9.55,
//       "American Home Life Insurance Company": 0.98
//     },
//     "inactiveShareByCarrier": {
//       "RNA": 7.79,
//       "Aetna": 22.83,
//       "Aflac": 32,
//       "Combined": 13,
//       "American Amicable / Occidental": 22.95,
//       "American Home Life Insurance Company": 1.42
//     }
//   }
// }

// Helper functions to process data
const getCarrierPersistencyData = (carrier: any) => {
  if (!carrier.timeRanges || carrier.timeRanges["3"].positiveCount === null) {
    return null
  }
  
  return [
    { period: '3 Months', persistency: carrier.timeRanges["3"].positivePercentage },
    { period: '6 Months', persistency: carrier.timeRanges["6"].positivePercentage },
    { period: '9 Months', persistency: carrier.timeRanges["9"].positivePercentage },
    { period: 'All Time', persistency: carrier.timeRanges["All"].positivePercentage },
  ]
}

const getCarrierPolicyData = (carrier: any) => {
  if (!carrier.timeRanges || carrier.timeRanges["3"].positiveCount === null) {
    return null
  }
  
  return [
    { period: '3 Months', active: carrier.timeRanges["3"].positiveCount, inactive: carrier.timeRanges["3"].negativeCount },
    { period: '6 Months', active: carrier.timeRanges["6"].positiveCount, inactive: carrier.timeRanges["6"].negativeCount },
    { period: '9 Months', active: carrier.timeRanges["9"].positiveCount, inactive: carrier.timeRanges["9"].negativeCount },
    { period: 'All Time', active: carrier.timeRanges["All"].positiveCount, inactive: carrier.timeRanges["All"].negativeCount },
  ]
}

const getStatusBreakdownData = (carrier: any, timeRange: string = "All") => {
  const breakdown = carrier.statusBreakdowns[timeRange]
  if (!breakdown) return []
  
  const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#84cc16', '#06b6d4', '#f97316', '#ec4899']
  
  return Object.entries(breakdown)
    .filter(([key, value]: [string, any]) => value && value.count !== null && value.count > 0)
    .map(([key, value]: [string, any], index) => ({
      name: key,
      value: value.count,
      percentage: value.percentage,
      color: colors[index % colors.length]
    }))
}

// Function to generate carrier comparison data
const generateCarrierComparisonData = (persistencyData: any) => {
  const activePoliciesByCarrier = Object.entries(persistencyData.carrier_comparison.activeShareByCarrier)
    .filter(([carrier, share]: [string, any]) => share !== null && share > 0)
    .map(([carrier, share]: [string, any], index) => ({
      name: carrier,
      value: Math.round((share / 100) * persistencyData.overall_analytics.activeCount),
      color: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#84cc16', '#06b6d4'][index % 6]
    }))

  const inactivePoliciesByCarrier = Object.entries(persistencyData.carrier_comparison.inactiveShareByCarrier)
    .filter(([carrier, share]: [string, any]) => share !== null && share > 0)
    .map(([carrier, share]: [string, any], index) => ({
      name: carrier,
      value: Math.round((share / 100) * persistencyData.overall_analytics.inactiveCount),
      color: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#84cc16', '#06b6d4'][index % 6]
    }))

  const carrierComparisonData = persistencyData.carriers
    .filter((carrier: any) => carrier.persistencyRate > 0)
    .map((carrier: any) => ({
      carrier: carrier.carrier,
      persistency: carrier.persistencyRate
    }))

  return {
    activePoliciesByCarrier,
    inactivePoliciesByCarrier,
    carrierComparisonData
  }
}


export default function Persistency() {
  const [showCarrierComparison, setShowCarrierComparison] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dynamic persistency data from Supabase RPC
  const [persistencyData, setPersistencyData] = useState<any>(null)
  
  // Fetch persistency data from Supabase RPC
  useEffect(() => {
    const fetchPersistencyData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const supabase = createClient()
        
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          throw new Error('User not authenticated')
        }
        
        // Get agency ID for the user
        const agencyId = await getAgencyId(supabase, user.id)
        
        // Call the RPC function
        const { data, error: rpcError } = await supabase.rpc('analyze_persistency_for_deals', { 
          p_agency_id: agencyId 
        })
        
        if (rpcError) {
          throw new Error(`RPC Error: ${rpcError.message}`)
        }
        
        if (data) {
          setPersistencyData(data)
        } else {
          throw new Error('No data returned from RPC function')
        }
        
      } catch (err) {
        console.error('Error fetching persistency data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch persistency data')
        // No fallback data available - user will see error state
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchPersistencyData()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      const windowHeight = window.innerHeight
      
      // Show carrier comparison when user scrolls down (more sensitive trigger)
      if (scrollPosition > 200) {
        setShowCarrierComparison(true)
      } else {
        setShowCarrierComparison(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Show loading state
  if (isLoading || !persistencyData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading persistency data...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-600">
              Please check your connection and try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Generate dynamic data based on current persistency data (only after data is loaded)
  const overallPersistencyData = [
    { period: '3 Months', persistency: persistencyData.overall_analytics.timeRanges["3"].activePercentage },
    { period: '6 Months', persistency: persistencyData.overall_analytics.timeRanges["6"].activePercentage },
    { period: '9 Months', persistency: persistencyData.overall_analytics.timeRanges["9"].activePercentage },
    { period: 'All Time', persistency: persistencyData.overall_analytics.timeRanges["All"].activePercentage },
  ]

  const overallPolicyData = [
    { period: '3 Months', active: persistencyData.overall_analytics.timeRanges["3"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["3"].inactiveCount },
    { period: '6 Months', active: persistencyData.overall_analytics.timeRanges["6"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["6"].inactiveCount },
    { period: '9 Months', active: persistencyData.overall_analytics.timeRanges["9"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["9"].inactiveCount },
    { period: 'All Time', active: persistencyData.overall_analytics.timeRanges["All"].activeCount, inactive: persistencyData.overall_analytics.timeRanges["All"].inactiveCount },
  ]

  const { activePoliciesByCarrier, inactivePoliciesByCarrier, carrierComparisonData } = generateCarrierComparisonData(persistencyData)

  return (
    <div className="min-h-screen bg-white -m-4 lg:-m-6">
      <div className="container mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Persistency</h1>
            <h2 className="text-2xl font-light text-gray-600 mt-2">Overall Analytics</h2>
          </div>
          <div className="flex items-center space-x-4">
            <Select defaultValue="3months">
              <SelectTrigger className="w-40 text-black bg-white border-gray-300">
                <SelectValue className="text-black" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300">
                <SelectItem value="3months" className="text-black hover:bg-gray-100">3 Months</SelectItem>
                <SelectItem value="6months" className="text-black hover:bg-gray-100">6 Months</SelectItem>
                <SelectItem value="9months" className="text-black hover:bg-gray-100">9 Months</SelectItem>
                <SelectItem value="alltime" className="text-black hover:bg-gray-100">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-black text-white hover:bg-gray-800 px-4 py-2"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Policy Reports
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Overall Persistency */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Overall Persistency</h3>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">All Time</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{persistencyData.overall_analytics.overallPersistency}%</p>
            <p className="text-sm text-gray-600">All Carriers Combined</p>
            <p className="text-xs text-gray-500">Total Policies: {persistencyData.overall_analytics.activeCount + persistencyData.overall_analytics.inactiveCount}</p>
          </div>
        </div>

        {/* Active Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Active Policies</h3>
            <p className="text-3xl font-bold text-gray-900">{persistencyData.overall_analytics.activeCount.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Persisting Across All Carriers</p>
          </div>
        </div>

        {/* Inactive Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Inactive Policies</h3>
            <p className="text-3xl font-bold text-gray-900">{persistencyData.overall_analytics.inactiveCount.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Persisting Across All Carriers</p>
          </div>
        </div>

        {/* Total Policies */}
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Total Policies</h3>
            <p className="text-3xl font-bold text-gray-900">{(persistencyData.overall_analytics.activeCount + persistencyData.overall_analytics.inactiveCount).toLocaleString()}</p>
            <p className="text-sm text-gray-600">All Carriers Combined</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Active/Inactive Policies */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active and Inactive Policies</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallPolicyData} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Date Range', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Number of Policies', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      value,
                      name === 'active' ? 'Active Policies' : 'Inactive Policies'
                    ]}
                  />
                  <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="active" fill="#10b981" name="Active Policies" />
                  <Bar dataKey="inactive" fill="#ef4444" name="Inactive Policies" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Line Chart - Persistency Trends */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Persistency Trends</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overallPersistencyData} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Date Range', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      `${value}%`,
                      'Persistency Rate'
                    ]}
                  />
                  <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Line
                    type="monotone"
                    dataKey="persistency"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2 }}
                    name="Persistency Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Carrier Comparison Section */}
      <div className="mt-12">
          <h2 className="text-2xl font-light text-gray-600 mb-6">Carrier Comparison</h2>
        
        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Active Policies Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Active Policies by Carrier</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activePoliciesByCarrier}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {activePoliciesByCarrier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [value, 'Active Policies']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Inactive Policies Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Inactive Policies by Carrier</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inactivePoliciesByCarrier}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {inactivePoliciesByCarrier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [value, 'Inactive Policies']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Carrier Comparison Bar Chart */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Persistency Rates by Carrier</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carrierComparisonData} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="carrier" 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Carrier', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 30, right: 30 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#666' }}
                    axisLine={{ stroke: '#e0e0e0' }}
                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      `${value}%`,
                      'Persistency Rate'
                    ]}
                  />
                  <Bar dataKey="persistency" fill="#8b5cf6" name="Persistency Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Analysis Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-light text-gray-600 mb-6">Leads Analysis</h2>
        
        {/* Summary Statistics */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Average Leads Needed</h3>
                <p className="text-3xl font-bold text-gray-900">2.04</p>
                <p className="text-sm text-gray-600">For One Active Customer</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Overall Lead Placement</h3>
                <p className="text-3xl font-bold text-gray-900">53.1%</p>
                <p className="text-sm text-gray-600">Across All Lead Types</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Active Conversion Rate</h3>
                <p className="text-3xl font-bold text-gray-900">58.6%</p>
                <p className="text-sm text-gray-600">From Placed Leads</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Lead Distribution Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Distribution of Leads</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Not Placed', value: 800, color: '#ef4444' },
                        { name: 'Active', value: 654, color: '#10b981' },
                        { name: 'Inactive', value: 346, color: '#f59e0b' },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Not Placed', value: 800, color: '#ef4444' },
                        { name: 'Active', value: 654, color: '#10b981' },
                        { name: 'Inactive', value: 346, color: '#f59e0b' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [value, 'Leads']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Placement Rate by Lead Type Pie Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Placement Rate by Lead Type</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Referrals', value: 75.2, color: '#8b5cf6' },
                        { name: 'Ads', value: 45.8, color: '#10b981' },
                        { name: 'Third Party', value: 38.4, color: '#f59e0b' },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Referrals', value: 75.2, color: '#8b5cf6' },
                        { name: 'Ads', value: 45.8, color: '#10b981' },
                        { name: 'Third Party', value: 38.4, color: '#f59e0b' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name) => [`${value}%`, 'Placement Rate']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Placement Bar Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lead Placement by Type</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { leadType: 'Referrals', placed: 75.2, notPlaced: 24.8, placedCount: 752, notPlacedCount: 248 },
                    { leadType: 'Ads', placed: 45.8, notPlaced: 54.2, placedCount: 458, notPlacedCount: 542 },
                    { leadType: 'Third Party', placed: 38.4, notPlaced: 61.6, placedCount: 384, notPlacedCount: 616 },
                  ]} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="leadType" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Lead Type', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                      domain={['dataMin', 'dataMax']}
                      padding={{ left: 30, right: 30 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Placement Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => {
                        const data = props.payload
                        if (name === 'placed') {
                          return [`Placed Leads: ${value}% (${data.placedCount} leads)`, '']
                        } else if (name === 'notPlaced') {
                          return [`Not Placed Leads: ${value}% (${data.notPlacedCount} leads)`, '']
                        }
                        return [value, name]
                      }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="placed" fill="#10b981" name="Placed Leads" />
                    <Bar dataKey="notPlaced" fill="#ef4444" name="Not Placed Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Lead Conversion Bar Chart */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lead Conversion to Active Customers</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { leadType: 'Referrals', activeConversion: 65.4, inactiveConversion: 34.6, activeCount: 491, inactiveCount: 261 },
                    { leadType: 'Ads', activeConversion: 58.2, inactiveConversion: 41.8, activeCount: 267, inactiveCount: 191 },
                    { leadType: 'Third Party', activeConversion: 52.1, inactiveConversion: 47.9, activeCount: 200, inactiveCount: 184 },
                  ]} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="leadType" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Lead Type', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                      domain={['dataMin', 'dataMax']}
                      padding={{ left: 30, right: 30 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Conversion Rate (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value, name, props) => {
                        const data = props.payload
                        if (name === 'activeConversion') {
                          return [`${value}% (${data.activeCount} leads)`, 'Active Conversion']
                        } else if (name === 'inactiveConversion') {
                          return [`${value}% (${data.inactiveCount} leads)`, 'Inactive Conversion']
                        }
                        return [`${value}%`, name]
                      }}
                    />
                    <Legend align="right" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="activeConversion" fill="#10b981" name="Active Conversion" />
                    <Bar dataKey="inactiveConversion" fill="#f59e0b" name="Inactive Conversion" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Leads Per Customer Chart */}
        <div className="mt-6">
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">Average Leads Needed to Acquire One Customer</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { leadType: 'Referrals', leadsPerCustomer: 2.04, totalLeads: 1000, activeCustomers: 491 },
                    { leadType: 'Ads', leadsPerCustomer: 3.75, totalLeads: 1000, activeCustomers: 267 },
                    { leadType: 'Third Party', leadsPerCustomer: 5.00, totalLeads: 1000, activeCustomers: 200 },
                  ]} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="leadType" 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Lead Type', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                      domain={['dataMin', 'dataMax']}
                      padding={{ left: 30, right: 30 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: '#666' }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ value: 'Leads Per Customer', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [`${value} leads`]}
                    />
                    <Bar dataKey="leadsPerCustomer" fill="#8b5cf6" name="Leads Per Customer">
                      {[
                        { leadType: 'Referrals', leadsPerCustomer: 2.04, totalLeads: 1000, activeCustomers: 491 },
                        { leadType: 'Ads', leadsPerCustomer: 3.75, totalLeads: 1000, activeCustomers: 267 },
                        { leadType: 'Third Party', leadsPerCustomer: 5.00, totalLeads: 1000, activeCustomers: 200 },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#8b5cf6' : index === 1 ? '#10b981' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Carrier Sections */}
      {persistencyData.carriers.map((carrier: any, index: number) => (
        <div key={carrier.carrier} className="mt-12">
          <h2 className="text-2xl font-light text-gray-600 mb-6">{carrier.carrier}</h2>
          
          {/* Carrier Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Persistency Rate</h3>
                <p className="text-3xl font-bold text-gray-900">{carrier.persistencyRate}%</p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Total Policies</h3>
                <p className="text-3xl font-bold text-gray-900">{carrier.totalPolicies.toLocaleString()}</p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Active Policies</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {carrier.timeRanges.All?.positiveCount ? carrier.timeRanges.All.positiveCount.toLocaleString() : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Inactive Policies</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {carrier.timeRanges.All?.negativeCount ? carrier.timeRanges.All.negativeCount.toLocaleString() : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">All Time</p>
              </div>
            </div>
          </div>

          {/* Carrier Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown Pie Chart */}
            <div className="border border-gray-200 rounded-lg bg-white">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold text-gray-900">Status Breakdown</h3>
              </div>
              <div className="px-6 pb-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getStatusBreakdownData(carrier, "All")}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {getStatusBreakdownData(carrier, "All").map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value, name) => [value, 'Policies']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Persistency Over Time */}
            {getCarrierPersistencyData(carrier) && (
              <div className="border border-gray-200 rounded-lg bg-white">
                <div className="p-6 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Persistency Over Time</h3>
                </div>
                <div className="px-6 pb-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getCarrierPersistencyData(carrier) || []} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fontSize: 12, fill: '#666' }}
                          axisLine={{ stroke: '#e0e0e0' }}
                          label={{ value: 'Date Range', position: 'insideBottom', offset: -10, style: { textAnchor: 'middle', fill: '#666' } }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12, fill: '#666' }}
                          axisLine={{ stroke: '#e0e0e0' }}
                          label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#666' } }}
                        />
                        <Tooltip
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          formatter={(value, name) => [
                            `${value}%`,
                            'Persistency Rate'
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="persistency"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
                          activeDot={{ r: 5, stroke: '#8b5cf6', strokeWidth: 2 }}
                          name="Persistency Rate"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}


      </div>
      
      {/* Upload Policy Reports Modal */}
      <UploadPolicyReportsModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </div>
  )
}
