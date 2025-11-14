import { cn } from "@/lib/utils"

interface InitialsAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Generate a consistent color based on the name
function getColorFromName(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ]

  // Simple hash function to get consistent color for same name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

// Extract initials from name (e.g., "John Smith" -> "JS")
function getInitials(name: string): string {
  if (!name || name.trim() === '') return '?'

  const parts = name.trim().split(/\s+/)

  if (parts.length === 1) {
    // Single name: use first two characters
    return parts[0].substring(0, 2).toUpperCase()
  }

  // Multiple parts: use first letter of first and last parts
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function InitialsAvatar({ name, size = 'md', className }: InitialsAvatarProps) {
  const initials = getInitials(name)
  const bgColor = getColorFromName(name)

  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
        bgColor,
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
