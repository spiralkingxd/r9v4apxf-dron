import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https://*.supabase.co https://api.twitch.tv https://id.twitch.tv wss://*.supabase.co",
      "frame-src 'self' https://player.twitch.tv https://embed.twitch.tv",
      "media-src 'self' https:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Opting into optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
      {
        protocol: "https",
        hostname: "**.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "**.discordapp.net",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=300" }],
      },
      {
        source: "/events",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=20, stale-while-revalidate=120" }],
      },
      {
        source: "/events/:path*",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=15, stale-while-revalidate=90" }],
      },
      {
        source: "/teams",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=20, stale-while-revalidate=120" }],
      },
      {
        source: "/ranking",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=15, stale-while-revalidate=90" }],
      },
      {
        source: "/transmissoes",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=10, stale-while-revalidate=60" }],
      },
    ];
  },
};

export default nextConfig;
