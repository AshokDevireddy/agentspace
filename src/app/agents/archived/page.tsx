import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/server"

type ArchivedRow = {
  first_name: string
  last_name: string
  updated_at: string
  positions: { name: string } | null
}

export default async function ArchivedAgents({ searchParams }: { searchParams?: { agencyId?: string } }) {
  const supabase = createAdminClient()
  const agencyId = searchParams?.agencyId || null
  // NOTE: using updated_at as a proxy for archived time; consider adding archived_at in DB
  let query = supabase
    .from('users')
    .select(`first_name, last_name, is_active, updated_at, positions:position_id(name)`) // denormalized join
    .eq('is_active', false)
  if (agencyId) {
    query = query.eq('agency_id', agencyId)
  }
  const { data: rows } = await query.order('updated_at', { ascending: false })

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Link href="/agents" className="flex items-center text-gray-600 hover:text-gray-900 mr-4">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Archived Agents</h1>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-6 font-medium text-gray-600">Last Name</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">First Name</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Position</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Time Archived</th>
              </tr>
            </thead>
            <tbody>
              {(((rows || []) as unknown) as ArchivedRow[]).map((u, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6 text-gray-900">{u.last_name}</td>
                  <td className="py-4 px-6 text-gray-900">{u.first_name}</td>
                  <td className="py-4 px-6 text-gray-900">{u.positions?.name ?? ''}</td>
                  <td className="py-4 px-6 text-gray-900">{new Date(u.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}