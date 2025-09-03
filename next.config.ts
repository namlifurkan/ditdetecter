import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure single instance for game state management
  experimental: {
    serverComponentsHmrCache: false, // Disable caching that might interfere with game state
  },
  
  // Production optimizations
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  // Headers for SSE and WebSocket compatibility
  async headers() {
    return [
      {
        source: '/api/events',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Connection',
            value: 'keep-alive',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
