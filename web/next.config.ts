import type { NextConfig } from "next";

// Photos are served from this project's public Storage bucket only (supabase/media.sql).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
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
