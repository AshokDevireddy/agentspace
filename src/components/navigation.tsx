"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronRight,
  User,
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Settings,
  Home,
  MessageSquare,
  Phone,
  LogOut,
  Building2,
  Mail
} from "lucide-react"
import { createClient } from '@/lib/supabase/client'

const navigationItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Scoreboard", href: "/scoreboard", icon: BarChart3 },
  {
    name: "Agents",
    href: "/agents",
    icon: Users,
    submenu: [
      { name: "All Agents", href: "/agents" },
      { name: "Contracts", href: "/agents/contracts" },
    ]
  },
  {
    name: "Policies",
    href: "/policies",
    icon: FileText,
    submenu: [
      { name: "Post a Deal", href: "/policies/post" },
      { name: "Book of Business", href: "/policies/book" },
    ]
  },
  {
    name: "Communications",
    href: "/communications",
    icon: MessageSquare,
    submenu: [
      { name: "Email Center", href: "/communications/email" },
      { name: "SMS Messaging", href: "/communications/sms" },
      { name: "Call Center", href: "/communications/calls" },
    ]
  },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
]

export default function Navigation() {
  const { signOut, user } = useAuth()
  const pathname = usePathname()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Check if user is admin by querying the database
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false)
        setAdminLoading(false)
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
      } finally {
        setAdminLoading(false)
      }
    }

    checkAdminStatus()
  }, [user])

  const handleDropdownToggle = (itemName: string) => {
    setOpenDropdown(openDropdown === itemName ? null : itemName)
  }

  // Handle user logout
  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Filter submenu items based on admin status
  const getFilteredSubmenu = (submenu: any[]) => {
    return submenu.filter(item => !item.adminOnly || isAdmin)
  }

  // Check if current path matches item
  const isActiveItem = (item: any) => {
    if (pathname === item.href) return true
    if (item.submenu) {
      return item.submenu.some((subItem: any) => pathname === subItem.href) ||
             pathname.startsWith(item.href + '/')
    }
    return false
  }

  const isActiveSubItem = (subItem: any) => {
    return pathname === subItem.href
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
              <span className="text-lg font-bold text-sidebar-foreground">AgentView</span>
              <span className="text-xs text-muted-foreground">CRM Platform</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <div key={item.name}>
            {item.submenu ? (
              <>
                <button
                  onClick={() => handleDropdownToggle(item.name)}
                  className={cn(
                    "sidebar-nav-item w-full rounded-xl",
                    isActiveItem(item) && "active"
                  )}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
                  {!isSidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform flex-shrink-0",
                        openDropdown === item.name ? "rotate-90" : ""
                      )} />
                    </>
                  )}
                </button>

                {/* Submenu */}
                {openDropdown === item.name && !isSidebarCollapsed && (
                  <div className="sidebar-submenu">
                    {getFilteredSubmenu(item.submenu).map((subItem) => (
                      <Link
                        key={subItem.name}
                        href={subItem.href}
                        className={cn(
                          "sidebar-submenu-item rounded-lg",
                          isActiveSubItem(subItem) && "active"
                        )}
                      >
                        <span className="w-2 h-2 rounded-full bg-current opacity-40 flex-shrink-0" />
                        <span>{subItem.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
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
              </Link>
            )}
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
            title={isSidebarCollapsed ? "Configuration" : undefined}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="flex-1 text-left">Configuration</span>}
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