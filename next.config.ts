import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    // Keep server actions under the default 1MB limit but allow large
    // multipart uploads to flow through route handlers instead.
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default nextConfig;