import type { NextConfig } from "next";

const nextConfig = {
  // pdf-parse v2 is ESM — must not be bundled by Turbopack
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // Skip lint/type checks during Vercel build (run separately in CI)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
} satisfies Record<string, unknown> as NextConfig;

export default nextConfig;
