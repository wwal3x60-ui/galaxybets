import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.GB_LOCAL_PREVIEW === '1' ? '.next-galaxy' : '.next',
  images: {
    qualities: [75, 90],
    remotePatterns: [{ protocol: "https", hostname: "gateway.pinata.cloud" }],
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {source:'/socket.io/:path*',destination:(process.env.API_INTERNAL_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '') + '/socket.io/:path*'},
      {
        source: '/api/v1/:path*',
        destination: (process.env.API_INTERNAL_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '') + '/:path*',
      },
    ];
  },
};

export default nextConfig;