import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // Proxy /api/* to the NestJS server so the refresh-token cookie stays
  // first-party (same origin from the browser's point of view) — avoids
  // CORS/SameSite complications entirely. See docs/PLAN.md "Auth wiring".
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
