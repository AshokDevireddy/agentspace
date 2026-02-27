'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, User, Mail, Phone, MapPin, Calendar, DollarSign, CreditCard, Hash, Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'
import { useAuth } from '@/providers/AuthProvider'
import { apiClient } from '@/lib/api-client'

interface Deal {
  id: string
  policyNumber: string
  applicationNumber: string
  clientName: string
  clientEmail: string
  clientPhone: string
  dateOfBirth: string
  ssnLast4: string
  clientAddress: string
  monthlyPremium: number
  annualPremium: number
  policyEffectiveDate: string
  status: string
  createdAt: string
  agent: {
    firstName: string
    lastName: string
    email: string
    phoneNumber: string
  } | null
  carrier: {
    displayName: string
  } | null
  product: {
    name: string
  } | null
}

interface UserData {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  role: string
  agencyId?: string
}

interface AgencyData {
  displayName?: string
  name?: string
  logoUrl?: string
}

interface DashboardResponse {
  user: UserData
  agency: AgencyData | null
}

interface DealsResponse {
  deals: Deal[]
}

export default function ClientDashboard() {
  const router = useRouter()
  const { user: authUser, loading: authLoading, signOut } = useAuth()

  // Query for dashboard data (user profile + agency branding)
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: queryKeys.clientUser(),
    queryFn: async () => {
      const response = await apiClient.get<DashboardResponse>('/api/client/dashboard/')

      if (response.user.role !== 'client') {
        throw new Error('Not a client')
      }

      return response
    },
    enabled: !authLoading && !!authUser,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  const userData = dashboardData?.user
  const agencyData = dashboardData?.agency

  // Query for client's deals
  const { data: deals = [], isLoading: dealsLoading, error: dealsError } = useQuery({
    queryKey: queryKeys.clientDeals(userData?.id || ''),
    queryFn: async () => {
      if (!userData?.id) return []

      const response = await apiClient.get<DealsResponse>('/api/client/deals/')

      return response.deals
    },
    enabled: !!userData?.id,
    staleTime: 2 * 60 * 1000,
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
    if (authUser?.role && authUser.role !== 'client') {
      router.push('/')
      return
    }

    // Handle query errors
    if (dashboardError) {
      const errorMessage = dashboardError.message
      if (errorMessage === 'Not authenticated' || errorMessage === 'Profile not found') {
        router.push('/login')
      } else if (errorMessage === 'Not a client') {
        router.push('/')
      }
    }
  }, [authLoading, authUser, dashboardError, router])

  // Derived values
  const user = userData
  const agencyName = agencyData?.displayName || agencyData?.name || "AgentSpace"
  const agencyLogo = agencyData?.logoUrl || null
  // Include authLoading to prevent rendering before auth state is known
  const loading = authLoading || dashboardLoading || (!!userData && dealsLoading)

  const handleSignOut = async () => {
    await signOut()
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
                  {user.firstName} {user.lastName}
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
                    <p className="text-lg font-semibold text-black dark:text-foreground">{user.firstName} {user.lastName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-black dark:text-foreground" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Email</p>
                    <p className="text-lg font-semibold text-black dark:text-foreground">{user.email}</p>
                  </div>
                </div>
                {user.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-black dark:text-foreground" />
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Phone</p>
                      <p className="text-lg font-semibold text-black dark:text-foreground">{user.phoneNumber}</p>
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
                          {deal.carrier?.displayName || 'N/A'} - {deal.product?.name || 'N/A'}
                        </CardTitle>
                        <p className="text-base text-gray-600 dark:text-muted-foreground mt-2 flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Policy: {deal.policyNumber || deal.applicationNumber || 'Pending'}
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
                          <p className="text-xl font-bold text-black dark:text-foreground">{formatCurrency(deal.monthlyPremium)}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-black dark:text-white mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Annual Premium</p>
                          <p className="text-xl font-bold text-black dark:text-foreground">{formatCurrency(deal.annualPremium)}</p>
                        </div>
                      </div>

                      {/* Policy Effective Date */}
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-black dark:text-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Effective Date</p>
                          <p className="text-base font-semibold text-black dark:text-foreground">{formatDate(deal.policyEffectiveDate)}</p>
                        </div>
                      </div>

                      {/* Client Address */}
                      {deal.clientAddress && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-black dark:text-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Address</p>
                            <p className="text-base font-semibold text-black dark:text-foreground">{deal.clientAddress}</p>
                          </div>
                        </div>
                      )}

                      {/* Date of Birth */}
                      {deal.dateOfBirth && (
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-black dark:text-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Date of Birth</p>
                            <p className="text-base font-semibold text-black dark:text-foreground">{formatDate(deal.dateOfBirth)}</p>
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
                                {deal.agent.firstName} {deal.agent.lastName}
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
                          {deal.agent.phoneNumber && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-black dark:text-foreground" />
                              <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Phone</p>
                                <a
                                  href={`tel:${deal.agent.phoneNumber}`}
                                  className="text-base font-semibold text-black dark:text-foreground hover:underline"
                                >
                                  {deal.agent.phoneNumber}
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

