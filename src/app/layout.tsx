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
import { isWhiteLabelDomain } from "@/lib/whitelabel";
import { getApiBaseUrl } from "@/lib/api-config";
import { getAuthSession } from "@/lib/auth/server";

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

  // If white-label, try to fetch agency branding from Django (public endpoint)
  if (isWhiteLabel) {
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(
        `${apiUrl}/api/agencies/by-domain?domain=${encodeURIComponent(hostname)}`,
        {
          cache: 'force-cache',
          next: { revalidate: 3600 }, // Cache for 1 hour
        }
      );

      if (response.ok) {
        const agency = await response.json();
        if (agency?.display_name) {
          title = `${agency.display_name} - Insurance Agency Management`;
          description = `Manage your ${agency.display_name} insurance agency policies and agents`;
        }
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
  // Read access_token cookie → Bearer to Django → hydrate AuthProvider
  const authSession = await getAuthSession();

  const initialUser = authSession?.user ?? null;
  const initialAccessToken = authSession?.accessToken ?? null;
  const agencyData = authSession?.agency ?? null;

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
              <AuthProvider initialUser={initialUser} initialAccessToken={initialAccessToken}>
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
