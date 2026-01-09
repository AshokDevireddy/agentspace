"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/providers/AuthProvider"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, getContrastTextColor } from "@/lib/utils"
import { useTheme } from "next-themes"
import {
  User,
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Settings,
  Home,
  LogOut,
  Building2,
  MessageSquare,
  ExternalLink,
  BookOpen,
  Sparkles,
  FolderOpen,
  DollarSign,
  ClipboardCheck
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queryKeys'

const navigationItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Scoreboard", href: "/scoreboard", icon: BarChart3 },
  { name: "Agents", href: "/agents", icon: Users },
  { name: "Post a Deal", href: "/policies/post", icon: FileText },
  { name: "Book of Business", href: "/policies/book", icon: BookOpen },
  { name: "Communication", href: "/communications/sms", icon: MessageSquare },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Expected Payouts", href: "/expected-payouts", icon: DollarSign },
  { name: "Insurance Toolkits", href: "/insurance-toolkits", icon: ExternalLink },
  // { name: "Resources", href: "/resources", icon: FolderOpen },
]

const proExpertNavigationItems = [
  { name: "Underwriting", href: "/underwriting", icon: ClipboardCheck },
]

const adminNavigationItems = [
  { name: "AI Mode", href: "/ai-chat", icon: Sparkles },
]

// Default primary color schemes for light and dark mode
const DEFAULT_PRIMARY_COLOR_LIGHT = "0 0% 0%" // Black for light mode
const DEFAULT_PRIMARY_COLOR_DARK = "0 0% 100%" // White for dark mode

// Helper function to get default primary color for a theme mode
const getDefaultPrimaryColor = (mode: 'light' | 'dark' | 'system' | string | null): string => {
  if (mode === 'dark') return DEFAULT_PRIMARY_COLOR_DARK
  if (mode === 'light') return DEFAULT_PRIMARY_COLOR_LIGHT
  return DEFAULT_PRIMARY_COLOR_LIGHT
}

// Helper function to check if a color is the default for a given mode
const isDefaultColorForMode = (color: string, mode: 'light' | 'dark' | 'system' | string | null): boolean => {
  const defaultColor = getDefaultPrimaryColor(mode)
  return color === defaultColor
}

export default function Navigation() {
  const { signOut, user, userData } = useAuth()
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const queryClient = useQueryClient()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const previousResolvedThemeRef = useRef<string | null>(null)

  // Create stable supabase client instance for realtime subscriptions
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Derive admin status and subscription tier from AuthProvider context
  const isAdmin = userData?.is_admin || false
  const subscriptionTier = userData?.subscription_tier || 'free'
  const agencyId = userData?.agency_id || null

  // Fetch agency branding with TanStack Query
  const { data: agencyData, isLoading: isLoadingAgency } = useQuery({
    queryKey: queryKeys.agencyBranding(agencyId),
    queryFn: async () => {
      if (!agencyId) return null

      const supabase = createClient()
      const { data } = await supabase
        .from('agencies')
        .select('display_name, name, logo_url, primary_color')
        .eq('id', agencyId)
        .maybeSingle()

      return data
    },
    enabled: !!agencyId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Derive agency values from query data
  const agencyName = agencyData?.display_name || agencyData?.name || "AgentSpace"
  const agencyLogo = agencyData?.logo_url || null
  const agencyColor = agencyData?.primary_color || "217 91% 60%"

  // Apply agency color to CSS variables when data changes
  useEffect(() => {
    if (agencyData?.primary_color) {
      document.documentElement.style.setProperty('--primary', agencyData.primary_color)

      // Set the foreground color based on the primary color's luminance
      const textColor = getContrastTextColor(agencyData.primary_color)
      document.documentElement.style.setProperty('--primary-foreground', textColor === 'white' ? '0 0% 100%' : '0 0% 0%')
    }
  }, [agencyData?.primary_color])

  // Handle automatic primary color switching when theme changes (from ThemeToggle)
  useEffect(() => {
    if (!agencyId || !resolvedTheme || !agencyColor || !agencyData) return

    const previousResolvedTheme = previousResolvedThemeRef.current
    const currentResolvedTheme = resolvedTheme

    // Only proceed if theme actually changed from light to dark or dark to light
    if (previousResolvedTheme && previousResolvedTheme !== currentResolvedTheme &&
        (previousResolvedTheme === 'light' || previousResolvedTheme === 'dark') &&
        (currentResolvedTheme === 'light' || currentResolvedTheme === 'dark')) {

      // Check if current primary color is the default for the previous mode
      const currentColor = agencyColor
      const isCurrentColorDefault = isDefaultColorForMode(currentColor, previousResolvedTheme as 'light' | 'dark')

      // If current color was the default for the previous mode, switch to default for new mode
      if (isCurrentColorDefault) {
        const newDefaultColor = getDefaultPrimaryColor(currentResolvedTheme as 'light' | 'dark')

        // Update CSS variables first (synchronous)
        document.documentElement.style.setProperty('--primary', newDefaultColor)
        const textColor = getContrastTextColor(newDefaultColor)
        document.documentElement.style.setProperty('--primary-foreground', textColor === 'white' ? '0 0% 100%' : '0 0% 0%')

        // Use requestAnimationFrame to ensure CSS is painted before cache update
        // This prevents visual flash by batching DOM updates before React re-render
        requestAnimationFrame(() => {
          queryClient.setQueryData(queryKeys.agencyBranding(agencyId), {
            ...agencyData,
            primary_color: newDefaultColor
          })
        })

        // Update database
        const updateColor = async () => {
          try {
            const supabase = createClient()
            const { error } = await supabase
              .from('agencies')
              .update({ primary_color: newDefaultColor })
              .eq('id', agencyId)

            if (error) {
              console.error('Error updating primary color:', error)
            }
          } catch (error) {
            console.error('Error updating primary color:', error)
          }
        }

        updateColor()
      }
    }

    // Update the ref for next comparison
    previousResolvedThemeRef.current = currentResolvedTheme
  }, [resolvedTheme, agencyId, agencyColor, agencyData, queryClient])

  // Fetch unread message count with TanStack Query
  const { data: unreadCountData } = useQuery({
    queryKey: queryKeys.conversationCount('self'),
    queryFn: async () => {
      try {
        // Use countOnly=true for lightweight unread count query
        const response = await fetch('/api/sms/conversations?view=self&countOnly=true', {
          credentials: 'include'
        })

        if (!response.ok) {
          return { unreadCount: 0 }
        }

        const data = await response.json()
        return { unreadCount: data.unreadCount || 0 }
      } catch (error) {
        console.error('Error fetching unread count:', error)
        return { unreadCount: 0 }
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute as a fallback
  })

  const unreadCount = unreadCountData?.unreadCount || 0

  // Subscribe to real-time message changes
  useEffect(() => {
    if (!user?.id) return

    // Subscribe to real-time message changes
    const channelName = `nav-unread-${user.id}`
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // When a new inbound message arrives, invalidate the query
          const newMessage = payload.new as { direction?: string }
          if (newMessage.direction === 'inbound') {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversationCount('self') })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // When a message is marked as read, invalidate the query
          const oldMessage = payload.old as { read_at?: string | null }
          const newMessage = payload.new as { read_at?: string | null; direction?: string }
          if (!oldMessage.read_at && newMessage.read_at && newMessage.direction === 'inbound') {
            queryClient.invalidateQueries({ queryKey: queryKeys.conversationCount('self') })
          }
        }
      )
      .subscribe()

    // Handle visibility change - refetch when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Invalidate query when tab becomes visible (catches any missed events)
        queryClient.invalidateQueries({ queryKey: queryKeys.conversationCount('self') })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id, supabase, queryClient])

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Check if current path matches item
  const isActiveItem = (item: any) => {
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <aside
      className={cn(
        "sidebar fixed left-0 top-0 z-50 flex flex-col transition-all duration-300 custom-scrollbar overflow-y-auto",
        "lg:translate-x-0", // Always visible on desktop
        "-translate-x-full lg:translate-x-0", // Hidden on mobile, visible on desktop
        isSidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
        <Link href="/" className="flex items-center space-x-3">
          {isLoadingAgency ? (
            <>
              {/* Loading skeleton for logo */}
              <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
              {!isSidebarCollapsed && (
                <div className="flex flex-col gap-2">
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
              )}
            </>
          ) : (
            <>
              {agencyLogo ? (
                <img
                  src={agencyLogo}
                  alt={`${agencyName} Logo`}
                  className="w-10 h-10 rounded-xl object-contain"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Error loading logo in navigation:', agencyLogo)
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-primary-foreground font-bold text-lg"
                  style={{ backgroundColor: `hsl(${agencyColor})` }}
                >
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-sidebar-foreground">{agencyName}</span>
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: 'Times New Roman, serif' }}>
                    Powered by AgentSpace
                  </span>
                </div>
              )}
            </>
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <div key={item.name} className="relative">
            <Link
              href={item.href}
              className={cn(
                "sidebar-nav-item w-full rounded-xl",
                isActiveItem(item) && "active"
              )}
              title={isSidebarCollapsed ? item.name : undefined}
              data-tour={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
              {!isSidebarCollapsed && <span className="flex-1 text-left">{item.name}</span>}
              {item.name === "Communication" && unreadCount > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </div>
        ))}

        {/* Pro/Expert tier navigation items */}
        {/* {(subscriptionTier === 'pro' || subscriptionTier === 'expert') && proExpertNavigationItems.map((item) => (
          <div key={item.name} className="relative">
            <Link
              href={item.href}
              className={cn(
                "sidebar-nav-item w-full rounded-xl",
                isActiveItem(item) && "active"
              )}
              title={isSidebarCollapsed ? item.name : undefined}
              data-tour={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
              {!isSidebarCollapsed && <span className="flex-1 text-left">{item.name}</span>}
            </Link>
          </div>
        ))} */}

        {/* Admin-only navigation items */}
        {isAdmin && adminNavigationItems.map((item) => (
          <div key={item.name} className="relative">
            <Link
              href={item.href}
              className={cn(
                "sidebar-nav-item w-full rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-500/20",
                isActiveItem(item) && "active from-purple-500/20 to-blue-500/20"
              )}
              title={isSidebarCollapsed ? item.name : undefined}
              data-tour={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {item.icon && <item.icon className="h-5 w-5 flex-shrink-0 text-purple-500" />}
              {!isSidebarCollapsed && (
                <span className="flex-1 text-left bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                  {item.name}
                </span>
              )}
            </Link>
          </div>
        ))}
      </nav>

      {/* Admin Configuration */}
      {isAdmin && (
        <div className="p-4 border-t border-sidebar-border">
          <Link
            href="/configuration"
            className={cn(
              "sidebar-nav-item w-full rounded-xl",
              pathname === "/configuration" && "active"
            )}
            title={isSidebarCollapsed ? "Settings" : undefined}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="flex-1 text-left">Settings</span>}
          </Link>
        </div>
      )}

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="space-y-2">
          <Link
            href="/user/profile"
            className={cn(
              "sidebar-nav-item w-full rounded-xl",
              pathname === "/user/profile" && "active"
            )}
            title={isSidebarCollapsed ? "Profile" : undefined}
          >
            <User className="h-5 w-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="flex-1 text-left">Profile</span>}
          </Link>

          <button
            onClick={handleLogout}
            className="sidebar-nav-item w-full rounded-xl text-destructive hover:bg-destructive/10"
            title={isSidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="flex-1 text-left">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}