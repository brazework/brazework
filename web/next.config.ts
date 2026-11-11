import type { NextConfig } from "next";

// Photos are served from this project's public Storage bucket only (supabase/media.sql).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

// Content-Security-Policy: what a page may load, and from where. This is Next's "without nonces"
// policy: nonces would force every page to render per request and rule out partial prerendering
// (see node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md). It still blocks
// scripts, frames and plugins from other sites, <base> hijacking, and forms posting elsewhere.
// Inline scripts stay allowed for now (Linear FIX-46: hash-based SRI is the next step).
const isLocal = !!supabase && ["localhost", "127.0.0.1"].includes(supabase.hostname);
const supabaseOrigins = supabase ? [supabase.origin, supabase.origin.replace(/^http/, "ws")] : [];
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabase?.origin ?? ""}`,
  `media-src 'self' blob: data: ${supabase?.origin ?? ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins.join(" ")}`,
  // The event page embeds a Google map.
  "frame-src https://maps.google.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  // Paying for a challenge redirects to Stripe Checkout.
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  ...(isLocal ? [] : ["upgrade-insecure-requests"]),
].join("; ");

// Sent with every response. The CI security scan (OWASP ZAP baseline) checks these are present.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
    dangerouslyAllowLocalIP: isLocal,
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
