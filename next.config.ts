import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Next may pick up a stray lockfile in a parent folder as the project root.
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    // Admin forms carry at most one 4 MB attachment; Vercel caps bodies at 4.5 MB anyway.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
