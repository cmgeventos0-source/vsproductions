import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ufkzlmyxqwefdcvhdcli.supabase.co" },
    ],
  },
  experimental: {
    // Para versiones recientes de Next.js (14+)
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
