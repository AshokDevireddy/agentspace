import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider, UserData } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ThemeCoordinator } from "@/contexts/ThemeCoordinatorContext";
import { AgencyBrandingProvider } from "@/contexts/AgencyBrandingContext";
import { NotificationProvider } from "@/contexts/notification-context";
import { TourProvider } from "@/contexts/onboarding-tour-context";
import ClientLayout from "./client-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { isWhiteLabelDomain } from "@/lib/whitelabel";
import { getApiBaseUrl, authEndpoints } from "@/lib/api-config";
import { getSession } from "@/lib/session";

// Force dynamic rendering - ensures session is fetched on every request, not cached at build time
export const dynamic = 'force-dynamic';


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const hostname = headersList.get("host") || "";
  const isWhiteLabel = isWhiteLabelDomain(hostname);

  // Default metadata for AgentSpace
  let title = "AgentSpace - Insurance Agency Management";
  let description = "Manage your insurance agency commissions and payouts";

  // If white-label, try to fetch agency branding
  // Note: This still uses Supabase for metadata since it's before auth
  if (isWhiteLabel) {
    try {
      const supabase = await createServerClient();
      const { data: agency } = await supabase
        .from("agencies")
        .select("display_name")
        .eq("whitelabel_domain", hostname)
        .single();

      if (agency?.display_name) {
        title = `${agency.display_name} - Insurance Agency Management`;
        description = `Manage your ${agency.display_name} insurance agency policies and agents`;
      }
    } catch (error) {
      console.error("Error fetching agency branding for metadata:", error);
    }
  }

  return {
    title,
    description,
    icons: {
      icon: '/api/favicon',
      apple: '/api/favicon',
    },
  };
}

/**
 * Session data response from the backend API
 */
type SessionResponse = {
  authenticated: boolean
  user?: {
    id: string
    auth_user_id: string
    email: string
    agency_id: string | null
    role: 'admin' | 'agent' | 'client'
    is_admin: boolean
    status: 'active' | 'onboarding' | 'invited' | 'inactive'
    subscription_tier: 'free' | 'pro' | 'expert' | null
    theme_mode: 'light' | 'dark' | 'system' | null
  }
  agency?: {
    display_name: string | null
    whitelabel_domain: string | null
    logo_url: string | null
  } | null
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch session data from the httpOnly session cookie
  let initialUser: UserData | null = null;
  let agencyData = null;

  try {
    // Get access token from httpOnly session cookie
    const session = await getSession();

    if (session?.accessToken) {
      // Call backend API for session data - validates the JWT and returns user data
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}${authEndpoints.session}`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Don't cache auth data
      });

      if (response.ok) {
        const data: SessionResponse = await response.json();

        if (data.authenticated && data.user) {
          initialUser = {
            id: data.user.id,
            auth_user_id: data.user.auth_user_id,
            email: data.user.email,
            role: data.user.role,
            status: data.user.status,
            theme_mode: data.user.theme_mode,
            is_admin: data.user.is_admin,
            agency_id: data.user.agency_id,
            subscription_tier: data.user.subscription_tier || 'free',
          };

          agencyData = data.agency;
        }
      } else if (response.status === 401) {
        // Token is invalid - user needs to re-authenticate
        console.log('[Layout] Session invalid - token expired');
      } else {
        console.error('[Layout] Session request failed:', response.status);
      }
    }
  } catch (error) {
    // Log but don't crash - AuthProvider will handle client-side fallback
    console.error('[Layout] Error fetching session:', error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <AgencyBrandingProvider initialAgency={agencyData}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <AuthProvider initialUser={initialUser}>
                <ThemeCoordinator>
                  <NotificationProvider>
                    <TourProvider>
                      <ErrorBoundary>
                        <ClientLayout>
                          {children}
                        </ClientLayout>
                      </ErrorBoundary>
                    </TourProvider>
                  </NotificationProvider>
                </ThemeCoordinator>
              </AuthProvider>
            </ThemeProvider>
          </AgencyBrandingProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
