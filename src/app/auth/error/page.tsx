'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'An authentication error occurred'

  // Map common errors to user-friendly messages
  const getErrorMessage = (error: string): { title: string; description: string } => {
    const lowerError = error.toLowerCase()

    if (lowerError.includes('expired')) {
      return {
        title: 'Link Expired',
        description: 'Your authentication link has expired. Please request a new one.'
      }
    }
    if (lowerError.includes('invalid') || lowerError.includes('missing')) {
      return {
        title: 'Invalid Link',
        description: 'The authentication link is invalid. Please request a new one.'
      }
    }
    if (lowerError.includes('not found') || lowerError.includes('account not found')) {
      return {
        title: 'Account Not Found',
        description: 'We could not find an account associated with this link.'
      }
    }
    if (lowerError.includes('not accessible') || lowerError.includes('deactivated')) {
      return {
        title: 'Account Inaccessible',
        description: 'Your account is currently not accessible. Please contact support.'
      }
    }
    if (lowerError.includes('already')) {
      return {
        title: 'Already Used',
        description: 'This link has already been used. Please log in or request a new link.'
      }
    }

    return {
      title: 'Authentication Error',
      description: error
    }
  }

  const { title, description } = getErrorMessage(error)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-8">{description}</p>

        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link href="/login">Back to Login</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/reset-password">Request New Link</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}
