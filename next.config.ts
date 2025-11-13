import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/v1/:path*`,
      },
      {
        source: '/rest/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/:path*`,
      },
      {
        source: '/auth/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/:path*`,
      },
      {
        source: '/storage/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/:path*`,
      },
      {
        source: '/realtime/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/:path*`,
      },
    ]
  },
}

export default nextConfig

