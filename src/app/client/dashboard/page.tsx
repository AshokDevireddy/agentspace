'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, User, Mail, Phone, MapPin, Calendar, DollarSign, CreditCard, Hash } from 'lucide-react'

interface Deal {
  id: string
  policy_number: string
  application_number: string
  client_name: string
  client_email: string
  client_phone: string
  date_of_birth: string
  ssn_last_4: string
  client_address: string
  monthly_premium: number
  annual_premium: number
  policy_effective_date: string
  status: string
  created_at: string
  agent: {
    first_name: string
    last_name: string
    email: string
    phone_number: string
  }
  carrier: {
    display_name: string
  }
  product: {
    name: string
  }
}

export default function ClientDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserAndDeals()
  }, [])

  const fetchUserAndDeals = async () => {
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

      // Fetch deals for this client
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select(`
          *,
          agent:agent_id(first_name, last_name, email, phone_number),
          carrier:carrier_id(display_name),
          product:product_id(name)
        `)
        .eq('client_id', userData.id)
        .order('created_at', { ascending: false })

      if (!dealsError && dealsData) {
        setDeals(dealsData as any)
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AgentView Client Portal</h1>
            {user && (
              <p className="text-lg text-gray-600 mt-1">
                Welcome, {user.first_name} {user.last_name}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="text-base px-6 py-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Your Information Card */}
        {user && (
          <Card className="shadow-lg border-2 border-blue-100">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl flex items-center gap-2">
                <User className="h-6 w-6" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="text-lg font-semibold text-gray-900">{user.first_name} {user.last_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-lg font-semibold text-gray-900">{user.email}</p>
                  </div>
                </div>
                {user.phone_number && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="text-lg font-semibold text-gray-900">{user.phone_number}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Policies Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Your Policies
          </h2>

          {deals.length === 0 ? (
            <Card className="shadow-lg">
              <CardContent className="p-12 text-center">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Policies Yet</h3>
                <p className="text-gray-500 text-base">
                  Your agent will add your policy information here. Check back soon!
                </p>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    If you need immediate assistance, please contact your agent directly.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {deals.map((deal) => (
                <Card key={deal.id} className="shadow-lg border-2 border-gray-200 hover:border-blue-300 transition-all">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl text-gray-900 flex items-center gap-2">
                          {deal.carrier?.display_name || 'N/A'} - {deal.product?.name || 'N/A'}
                        </CardTitle>
                        <p className="text-base text-gray-600 mt-2 flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Policy: {deal.policy_number || deal.application_number || 'Pending'}
                        </p>
                      </div>
                      <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                        deal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        deal.status === 'active' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {deal.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Premium Information */}
                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-green-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Monthly Premium</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(deal.monthly_premium)}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-green-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Annual Premium</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(deal.annual_premium)}</p>
                        </div>
                      </div>

                      {/* Policy Effective Date */}
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-500">Effective Date</p>
                          <p className="text-base font-semibold text-gray-900">{formatDate(deal.policy_effective_date)}</p>
                        </div>
                      </div>

                      {/* Client Address */}
                      {deal.client_address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-blue-600 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-500">Address</p>
                            <p className="text-base font-semibold text-gray-900">{deal.client_address}</p>
                          </div>
                        </div>
                      )}

                      {/* Date of Birth */}
                      {deal.date_of_birth && (
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-blue-600 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                            <p className="text-base font-semibold text-gray-900">{formatDate(deal.date_of_birth)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Agent Information */}
                    {deal.agent && (
                      <div className="mt-6 pt-6 border-t-2 border-gray-200">
                        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <User className="h-5 w-5 text-blue-600" />
                          Your Agent
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-600">Name</p>
                              <p className="text-base font-semibold text-gray-900">
                                {deal.agent.first_name} {deal.agent.last_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-600">Email</p>
                              <a
                                href={`mailto:${deal.agent.email}`}
                                className="text-base font-semibold text-blue-600 hover:underline"
                              >
                                {deal.agent.email}
                              </a>
                            </div>
                          </div>
                          {deal.agent.phone_number && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-600" />
                              <div>
                                <p className="text-sm font-medium text-gray-600">Phone</p>
                                <a
                                  href={`tel:${deal.agent.phone_number}`}
                                  className="text-base font-semibold text-blue-600 hover:underline"
                                >
                                  {deal.agent.phone_number}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

