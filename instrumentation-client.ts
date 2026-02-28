import posthog from 'posthog-js'

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (typeof window !== 'undefined' && posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('PostHog loaded successfully')
        posthog.debug()
      }
      // Send a test event to verify PostHog is working
      posthog.capture('$pageview')
      console.log('Test pageview event sent')
    }
  })
}
