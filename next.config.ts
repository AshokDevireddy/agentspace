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
};

export default nextConfig;
