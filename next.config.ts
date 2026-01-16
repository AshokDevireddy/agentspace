import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // ⚠️ Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // Mark HyperAgent and Playwright as external to avoid Turbopack issues
  serverExternalPackages: [
    '@hyperbrowser/agent',
    'playwright',
    'playwright-core',
  ],
  // Suppress Supabase getSession warnings (they're informational, not actual security issues)
  webpack: (config, { isServer }) => {
    if (isServer) {
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        const message = args[0];
        if (typeof message === 'string' &&
            (message.includes('supabase.auth.getSession()') ||
             message.includes('supabase.auth.onAuthStateChange()'))) {
          return; // Suppress Supabase session warnings
        }
        originalWarn.apply(console, args);
      };
    }
    return config;
  },
};

export default nextConfig;
