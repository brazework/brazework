import type { NextConfig } from "next";

// Photos are served from this project's public Storage bucket only (supabase/media.sql).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

// Sent with every response. The CI security scan (OWASP ZAP baseline) checks these are present.
// No Content-Security-Policy yet: Next's inline scripts need nonces first (tracked in Linear, FOR-31).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nobody may frame our pages (clickjacking). We can still embed others, like the event map.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // allow-popups: connecting GitHub or Discord can open a sign-in window that must report back.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: supabase ? [new URL(`${supabase.origin}/storage/v1/object/public/media/**`)] : [],
    // The local test stack serves photos from localhost, which the optimizer refuses by default (an
    // SSRF guard). Allowed only when Supabase itself is local; remotePatterns still limits it to media.
    dangerouslyAllowLocalIP: !!supabase && ["localhost", "127.0.0.1"].includes(supabase.hostname),
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
