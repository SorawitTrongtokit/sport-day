import type { NextConfig } from "next";

// The read-write token names this project's Blob store ("vercel_blob_rw_<storeId>_…"), so the
// image optimizer only serves our own uploads rather than anyone's store. Without a token
// (local work without Blob) there are no uploads to protect, so any store is allowed.
const blobStoreId = /^vercel_blob_rw_([a-z0-9]+)_/i.exec(
  process.env.BLOB_READ_WRITE_TOKEN ?? "",
)?.[1];
const blobHost = blobStoreId
  ? `${blobStoreId.toLowerCase()}.public.blob.vercel-storage.com`
  : "*.public.blob.vercel-storage.com";

const nextConfig: NextConfig = {
  // Without this, Next may pick up a stray lockfile in a parent folder as the project root.
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: blobHost },
    ],
  },
  experimental: {
    // Admin forms carry at most one 4 MB attachment; Vercel caps bodies at 4.5 MB anyway.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
