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
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AgentSpace Client Portal</h1>
            {user && (
              <p className="text-lg text-muted-foreground mt-1">
                Welcome, {user.first_name} {user.last_name}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="text-base px-6 py-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Your Information Card */}
        {user && (
          <Card className="shadow-sm border border-border">
            <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
              <CardTitle className="text-2xl flex items-center gap-2">
                <User className="h-6 w-6" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-lg font-semibold text-foreground">{user.first_name} {user.last_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-lg font-semibold text-foreground">{user.email}</p>
                  </div>
                </div>
                {user.phone_number && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone</p>
                      <p className="text-lg font-semibold text-foreground">{user.phone_number}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Policies Section */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Your Policies
          </h2>

          {deals.length === 0 ? (
            <Card className="shadow-sm border border-border">
              <CardContent className="p-12 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Policies Yet</h3>
                <p className="text-muted-foreground text-base">
                  Your agent will add your policy information here. Check back soon!
                </p>
                <div className="mt-6 p-4 bg-accent rounded-lg">
                  <p className="text-sm text-accent-foreground">
                    If you need immediate assistance, please contact your agent directly.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {deals.map((deal) => (
                <Card key={deal.id} className="shadow-sm border border-border hover:border-primary transition-all">
                  <CardHeader className="bg-accent border-b border-border">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl text-foreground flex items-center gap-2">
                          {deal.carrier?.display_name || 'N/A'} - {deal.product?.name || 'N/A'}
                        </CardTitle>
                        <p className="text-base text-muted-foreground mt-2 flex items-center gap-2">
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
                          <p className="text-sm font-medium text-muted-foreground">Monthly Premium</p>
                          <p className="text-xl font-bold text-foreground">{formatCurrency(deal.monthly_premium)}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-green-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Annual Premium</p>
                          <p className="text-xl font-bold text-foreground">{formatCurrency(deal.annual_premium)}</p>
                        </div>
                      </div>

                      {/* Policy Effective Date */}
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-primary mt-1" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Effective Date</p>
                          <p className="text-base font-semibold text-foreground">{formatDate(deal.policy_effective_date)}</p>
                        </div>
                      </div>

                      {/* Client Address */}
                      {deal.client_address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-primary mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Address</p>
                            <p className="text-base font-semibold text-foreground">{deal.client_address}</p>
                          </div>
                        </div>
                      )}

                      {/* Date of Birth */}
                      {deal.date_of_birth && (
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-primary mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                            <p className="text-base font-semibold text-foreground">{formatDate(deal.date_of_birth)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Agent Information */}
                    {deal.agent && (
                      <div className="mt-6 pt-6 border-t border-border">
                        <h4 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" />
                          Your Agent
                        </h4>
                        <div className="grid md:grid-cols-2 gap-4 bg-accent p-4 rounded-lg">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Name</p>
                              <p className="text-base font-semibold text-foreground">
                                {deal.agent.first_name} {deal.agent.last_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-primary" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Email</p>
                              <a
                                href={`mailto:${deal.agent.email}`}
                                className="text-base font-semibold text-primary hover:underline"
                              >
                                {deal.agent.email}
                              </a>
                            </div>
                          </div>
                          {deal.agent.phone_number && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-primary" />
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                                <a
                                  href={`tel:${deal.agent.phone_number}`}
                                  className="text-base font-semibold text-primary hover:underline"
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

