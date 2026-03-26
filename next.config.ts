import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 is ESM — must not be bundled by Turbopack
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
