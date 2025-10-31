"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
  UserCheck,
  Sparkles
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'

const navigationItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Scoreboard", href: "/scoreboard", icon: BarChart3 },
  { name: "Agents", href: "/agents", icon: Users },
  { name: "Clients", href: "/clients", icon: UserCheck },
  { name: "Post a Deal", href: "/policies/post", icon: FileText },
  { name: "Book of Business", href: "/policies/book", icon: BookOpen },
  { name: "Communication", href: "/communications/sms", icon: MessageSquare },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Insurance Toolkits", href: "/insurance-toolkits", icon: ExternalLink },
]

const adminNavigationItems = [
  { name: "AI Mode", href: "/ai-chat", icon: Sparkles },
]

export default function Navigation() {
  const { signOut, user } = useAuth()
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Check if user is admin by querying the database
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false)
        return
      }

      try {
        const supabase = createClient()
        const { data: userData, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (error) {
          // Silently handle error - user may not exist in users table yet (e.g., during setup)
          setIsAdmin(false)
        } else {
          setIsAdmin(userData?.is_admin || false)
        }
      } catch (error) {
        // Silently handle error - user may not exist in users table yet
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [user])

  // Fetch unread message count
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const fetchUnreadCount = async () => {
      try {
        // Use 'self' view to minimize data transfer - we only need unread counts
        const response = await fetch('/api/sms/conversations?view=self', {
          credentials: 'include'
        })

        if (!response.ok) {
          setUnreadCount(0)
          return
        }

        const data = await response.json()
        const conversations = data.conversations || []
        const total = conversations.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0)
        setUnreadCount(total)
      } catch (error) {
        console.error('Error fetching unread count:', error)
        setUnreadCount(0)
      }
    }

    // Initial fetch
    fetchUnreadCount()

    // Poll for updates every 30 seconds, but pause when tab is hidden
    let interval: NodeJS.Timeout | null = null

    const startPolling = () => {
      // Clear any existing interval
      if (interval) clearInterval(interval)
      interval = setInterval(fetchUnreadCount, 30000)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    // Start polling if page is visible
    if (!document.hidden) {
      startPolling()
    }

    // Handle visibility change - pause polling when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // Fetch immediately when tab becomes visible, then resume polling
        fetchUnreadCount()
        startPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.id])

  // Handle user logout
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
    <aside className={cn(
      "sidebar fixed left-0 top-0 z-50 flex flex-col transition-all duration-300 custom-scrollbar overflow-y-auto",
      "lg:translate-x-0", // Always visible on desktop
      "-translate-x-full lg:translate-x-0", // Hidden on mobile, visible on desktop
      isSidebarCollapsed ? "w-16" : "w-64"
    )}>
      {/* Logo Section */}
      <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
        <Link href="/" className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            <Building2 className="h-6 w-6" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">AgentSpace</span>
              <span className="text-xs text-muted-foreground">CRM Platform</span>
            </div>
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