import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ThemeCoordinator } from "@/contexts/ThemeCoordinatorContext";
import { AgencyBrandingProvider } from "@/contexts/AgencyBrandingContext";
import { NotificationProvider } from "@/contexts/notification-context";
import { TourProvider } from "@/contexts/onboarding-tour-context";
import ClientLayout from "./client-layout";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AgencyBrandingProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <ThemeCoordinator>
                <NotificationProvider>
                  <TourProvider>
                    <ClientLayout>
                      {children}
                    </ClientLayout>
                  </TourProvider>
                </NotificationProvider>
              </ThemeCoordinator>
            </AuthProvider>
          </ThemeProvider>
        </AgencyBrandingProvider>
      </body>
    </html>
  );
}