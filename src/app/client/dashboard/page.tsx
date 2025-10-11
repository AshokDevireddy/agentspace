'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ClientDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser) {
        router.push('/login')
        return
      }

      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single()

      if (userError || !userData) {
        router.push('/login')
        return
      }

      // Verify user is a client
      if (userData.role !== 'client') {
        router.push('/')
        return
      }

      setUser(userData)
    } catch (error) {
      console.error('Error fetching user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AgentView Client Portal</h1>
            {user && (
              <p className="text-sm text-gray-600">
                Welcome, {user.first_name} {user.last_name}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, Client!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                Your client dashboard is currently being built. You will soon be able to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>View your policy information</li>
                <li>Track your applications</li>
                <li>Communicate with your agent</li>
                <li>Update your contact information</li>
                <li>Access important documents</li>
              </ul>
              <div className="pt-4 border-t border-gray-200 mt-4">
                <p className="text-sm text-gray-500">
                  If you need immediate assistance, please contact your agent directly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Info Card */}
        {user && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="text-gray-900">{user.first_name} {user.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="text-gray-900">{user.email}</span>
                </div>
                {user.phone_number && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Phone:</span>
                    <span className="text-gray-900">{user.phone_number}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

