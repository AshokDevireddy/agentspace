import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWhiteLabelDomain } from '@/lib/whitelabel'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const isWhiteLabel = isWhiteLabelDomain(hostname)

  let logoUrl: string | null = null

  // If white-label, try to fetch agency branding
  if (isWhiteLabel) {
    try {
      const supabase = createAdminClient()
      const { data: agency } = await supabase
        .from('agencies')
        .select('logo_url')
        .eq('whitelabel_domain', hostname)
        .single()

      logoUrl = agency?.logo_url || null
    } catch (error) {
      console.error('Error fetching agency branding for favicon:', error)
    }
  }

  // If we have a logo URL, fetch and return it
  if (logoUrl) {
    try {
      const imageResponse = await fetch(logoUrl)
      const imageBuffer = await imageResponse.arrayBuffer()

      // Return the agency logo as the favicon
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (error) {
      console.error('Error fetching logo:', error)
      // Fall through to default icon
    }
  }

  // Default: Create a simple black background with white "A" using canvas
  // Since edge runtime doesn't support JSX well, we'll create a simple SVG
  const svg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#000"/>
      <text
        x="16"
        y="24"
        font-family="Times New Roman, Times, serif"
        font-size="24"
        fill="#fff"
        text-anchor="middle"
        font-weight="bold"
      >A</text>
    </svg>
  `

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
