import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Get current user with admin status
export async function getCurrentUser() {
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .single()

  return user
}

// Get user's downline (all agents below them in hierarchy)
export async function getUserDownline(userId: string) {
  const { data, error } = await supabase.rpc('get_agent_downline', {
    agent_id: userId
  })

  if (error) {
    console.error('Error fetching downline:', error)
    return []
  }

  return data || []
}

// Get filtered data based on user permissions
export async function getVisibleAgents(currentUserId: string, isAdmin: boolean) {
  if (isAdmin) {
    // Admins can see all users
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        position:positions(*)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } else {
    // Regular users can only see their downline + themselves
    const downline = await getUserDownline(currentUserId)
    const visibleUserIds = [currentUserId, ...downline.map((u: { id: string }) => u.id)]

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        position:positions(*)
      `)
      .in('id', visibleUserIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

// Get commission reports (admin only)
export async function getCommissionReports() {
  const { data, error } = await supabase
    .from('commission_reports')
    .select(`
      *,
      carrier:carriers(*)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get positions
export async function getPositions(agencyId?: string) {
  let query = supabase
    .from('positions')
    .select('*')
    .eq('is_active', true)
    .order('level')

  if (agencyId) {
    query = query.eq('agency_id', agencyId)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Get carriers
export async function getCarriers() {
  const { data, error } = await supabase
    .from('carriers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data || []
}

// Get products for a carrier
export async function getProductsByCarrier(carrierId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('carrier_id', carrierId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data || []
}

// Get commission structures for a product
export async function getCommissionStructures(carrierId: string, productId?: string) {
  let query = supabase
    .from('commission_structures')
    .select(`
      *,
      position:positions(*),
      carrier:carriers(*),
      product:products(*)
    `)
    .eq('carrier_id', carrierId)
    .eq('is_active', true)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query.order('level')

  if (error) throw error
  return data || []
}

// Create or update commission structure
export async function upsertCommissionStructure(structure: {
  carrier_id: string
  product_id: string
  position_id: string
  percentage: number
  commission_type?: string
  level?: number
}) {
  const { data, error } = await supabase
    .from('commission_structures')
    .upsert({
      ...structure,
      commission_type: structure.commission_type || 'initial',
      level: structure.level || 0,
    })
    .select()

  if (error) throw error
  return data
}

// Create position
export async function createPosition(position: {
  name: string
  level: number
}) {
  const currentUser = await getCurrentUser()

  const { data, error } = await supabase
    .from('positions')
    .insert({
      ...position,
      created_by: currentUser?.id,
      agency_id: (currentUser as { agency_id?: string })?.agency_id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create product
export async function createProduct(product: {
  carrier_id: string
  name: string
  product_code?: string
}) {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single()

  if (error) throw error
  return data
}