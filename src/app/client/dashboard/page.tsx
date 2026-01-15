'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, User, Mail, Phone, MapPin, Calendar, DollarSign, CreditCard, Hash, Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useAuth } from '@/providers/AuthProvider'

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

interface UserData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number?: string
  role: string
  agency_id?: string
}

interface AgencyData {
  display_name?: string
  name?: string
  logo_url?: string
}

export default function ClientDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { user: authUser, userData: authUserData, loading: authLoading, signOut } = useAuth()

  // Query for full user profile data (extends AuthProvider's basic userData)
  const { data: userData, isLoading: userLoading, error: userError } = useQuery({
    queryKey: queryKeys.clientUser(),
    queryFn: async () => {
      if (!authUser) {
        throw new Error('Not authenticated')
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Profile not found')
      }

      if (profile.role !== 'client') {
        throw new Error('Not a client')
      }

      return profile as UserData
    },
    // Wait for AuthProvider to complete before running this query
    enabled: !authLoading && !!authUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2, // Allow retries for resilience
  })

  // Query for agency data
  const { data: agencyData } = useQuery({
    queryKey: queryKeys.agencyBranding(userData?.agency_id ?? null),
    queryFn: async () => {
      if (!userData?.agency_id) return null

      const { data } = await supabase
        .from('agencies')
        .select('display_name, name, logo_url')
        .eq('id', userData.agency_id)
        .maybeSingle()

      return data as AgencyData | null
    },
    enabled: !!userData?.agency_id,
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  // Query for client's deals
  const { data: deals = [], isLoading: dealsLoading, error: dealsError } = useQuery({
    queryKey: queryKeys.clientDeals(userData?.id || ''),
    queryFn: async () => {
      if (!userData?.id) return []

      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          agent:agent_id(first_name, last_name, email, phone_number),
          carrier:carrier_id(display_name),
          product:product_id(name)
        `)
        .eq('client_id', userData.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Deal[]
    },
    enabled: !!userData?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  })

  // Handle auth errors - redirect to login
  useEffect(() => {
    // Wait for auth to complete before making redirect decisions
    if (authLoading) return

    // If no user after auth completes, redirect to login
    if (!authUser) {
      router.push('/login')
      return
    }

    // If user is not a client (from AuthProvider), redirect to main dashboard
    if (authUserData?.role && authUserData.role !== 'client') {
      router.push('/')
      return
    }

    // Handle query errors
    if (userError) {
      const errorMessage = userError.message
      if (errorMessage === 'Not authenticated' || errorMessage === 'Profile not found') {
        router.push('/login')
      } else if (errorMessage === 'Not a client') {
        router.push('/')
      }
    }
  }, [authLoading, authUser, authUserData, userError, router])

  // Derived values
  const user = userData
  const agencyName = agencyData?.display_name || agencyData?.name || "AgentSpace"
  const agencyLogo = agencyData?.logo_url || null
  // Include authLoading to prevent rendering before auth state is known
  const loading = authLoading || userLoading || (!!userData && dealsLoading)

  const handleSignOut = () => {
    signOut()
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white dark:bg-black shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {agencyLogo ? (
              <img
                src={agencyLogo}
                alt={`${agencyName} Logo`}
                className="w-12 h-12 rounded-lg object-contain"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error('Error loading logo:', agencyLogo)
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-black text-white font-bold text-lg">
                <Building2 className="h-7 w-7" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{agencyName}</h1>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: 'Times New Roman, serif' }}>
                Powered by AgentSpace
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-white">Welcome,</p>
                <p className="text-base font-semibold text-black dark:text-white">
                  {user.first_name} {user.last_name}
                </p>
              </div>
              <Button
                onClick={handleSignOut}
                className="bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border dark:border-gray-600 text-white px-6 py-2"
              >
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Your Information Card */}
        {user && (
          <Card className="shadow-sm border border-gray-200 dark:border-gray-800 rounded-md">
            <CardHeader className="bg-black text-white rounded-t-md">
              <CardTitle className="text-2xl flex items-center gap-2">
                <User className="h-6 w-6" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white dark:bg-card">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-black dark:text-foreground" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Name</p>
                    <p className="text-lg font-semibold text-black dark:text-foreground">{user.first_name} {user.last_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-black dark:text-foreground" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Email</p>
                    <p className="text-lg font-semibold text-black dark:text-foreground">{user.email}</p>
                  </div>
                </div>
                {user.phone_number && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-black dark:text-foreground" />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Phone</p>
                      <p className="text-lg font-semibold text-black dark:text-foreground">{user.phone_number}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Policies Section */}
        <div className="space-y-6">
          <Card className="shadow-sm border border-gray-200 dark:border-gray-800 rounded-md">
            <CardHeader className="bg-black text-white rounded-t-md">
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Your Policies
              </CardTitle>
            </CardHeader>
            {dealsError && (
              <CardContent className="p-6 bg-white dark:bg-card">
                <div className="p-6 text-center bg-red-50 dark:bg-red-900/20 rounded-md">
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    Unable to load your policies. Please try again later.
                  </p>
                </div>
              </CardContent>
            )}
            {!dealsError && deals.length === 0 && !dealsLoading && (
              <CardContent className="p-6 bg-white dark:bg-card">
                <div className="p-12 text-center">
                  <FileText className="h-16 w-16 text-gray-400 dark:text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-black dark:text-foreground mb-2">No Policies Yet</h3>
                  <p className="text-gray-600 dark:text-muted-foreground text-base">
                    Your agent will add your policy information here. Check back soon!
                  </p>
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-muted rounded-md">
                    <p className="text-sm text-gray-700 dark:text-foreground">
                      If you need immediate assistance, please contact your agent directly.
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {!dealsError && deals.length > 0 && (
            <div className="space-y-6">
              {deals.map((deal) => (
                <Card key={deal.id} className="shadow-sm border border-gray-200 dark:border-gray-800 hover:border-black dark:hover:border-gray-600 transition-all rounded-md">
                  <CardHeader className="bg-gray-50 dark:bg-muted border-b border-gray-200 dark:border-gray-800 rounded-t-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl text-black dark:text-foreground flex items-center gap-2">
                          {deal.carrier?.display_name || 'N/A'} - {deal.product?.name || 'N/A'}
                        </CardTitle>
                        <p className="text-base text-gray-600 dark:text-muted-foreground mt-2 flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Policy: {deal.policy_number || deal.application_number || 'Pending'}
                        </p>
                      </div>
                      <span className={`px-4 py-2 rounded-md text-sm font-bold ${
                        deal.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        deal.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}>
                        {deal.status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 bg-white dark:bg-card">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Premium Information */}
                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-black dark:text-white mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Monthly Premium</p>
                          <p className="text-xl font-bold text-black dark:text-foreground">{formatCurrency(deal.monthly_premium)}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-black dark:text-white mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Annual Premium</p>
                          <p className="text-xl font-bold text-black dark:text-foreground">{formatCurrency(deal.annual_premium)}</p>
                        </div>
                      </div>

                      {/* Policy Effective Date */}
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-black dark:text-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Effective Date</p>
                          <p className="text-base font-semibold text-black dark:text-foreground">{formatDate(deal.policy_effective_date)}</p>
                        </div>
                      </div>

                      {/* Client Address */}
                      {deal.client_address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-black dark:text-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Address</p>
                            <p className="text-base font-semibold text-black dark:text-foreground">{deal.client_address}</p>
                          </div>
                        </div>
                      )}

                      {/* Date of Birth */}
                      {deal.date_of_birth && (
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-black dark:text-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Date of Birth</p>
                            <p className="text-base font-semibold text-black dark:text-foreground">{formatDate(deal.date_of_birth)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Agent Information */}
                    {deal.agent && (
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                        <h4 className="text-lg font-bold text-black dark:text-foreground mb-4 flex items-center gap-2">
                          <User className="h-5 w-5 text-black dark:text-foreground" />
                          Your Agent
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4 bg-gray-50 dark:bg-muted p-4 rounded-md">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-black dark:text-foreground" />
                            <div>
                              <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Name</p>
                              <p className="text-base font-semibold text-black dark:text-foreground">
                                {deal.agent.first_name} {deal.agent.last_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-black dark:text-foreground" />
                            <div>
                              <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Email</p>
                              <a
                                href={`mailto:${deal.agent.email}`}
                                className="text-base font-semibold text-black dark:text-foreground hover:underline"
                              >
                                {deal.agent.email}
                              </a>
                            </div>
                          </div>
                          {deal.agent.phone_number && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-black dark:text-foreground" />
                              <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Phone</p>
                                <a
                                  href={`tel:${deal.agent.phone_number}`}
                                  className="text-base font-semibold text-black dark:text-foreground hover:underline"
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

