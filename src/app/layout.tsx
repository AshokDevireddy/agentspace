import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch session on server (uses cookies, reliable on hard refresh)
  // This eliminates the client-side session recovery delay
  let initialUser = null;
  let initialUserData = null;

  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      // Extract only serializable user properties (methods can't be serialized)
      initialUser = {
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata,
      };

      // Fetch user profile data
      const { data: userData } = await supabase
        .from('users')
        .select('role, status, theme_mode, is_admin, agency_id, subscription_tier')
        .eq('auth_user_id', session.user.id)
        .single();

      if (userData) {
        initialUserData = {
          role: userData.role as 'admin' | 'agent' | 'client',
          status: userData.status as 'active' | 'onboarding' | 'invited' | 'inactive',
          theme_mode: userData.theme_mode as 'light' | 'dark' | 'system' | null,
          is_admin: userData.is_admin || false,
          agency_id: userData.agency_id || null,
          subscription_tier: (userData.subscription_tier || 'free') as 'free' | 'pro' | 'expert',
        };
      }
    }
  } catch (error) {
    // Log but don't crash - AuthProvider will handle client-side fallback
    console.error('[Layout] Error fetching initial session:', error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QueryProvider>
          <AgencyBrandingProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <AuthProvider
                initialUser={initialUser}
                initialUserData={initialUserData}
              >
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