import type { NextConfig } from "next";

// Photos are served from this project's public Storage bucket only (supabase/media.sql).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: supabase ? [new URL(`${supabase.origin}/storage/v1/object/public/media/**`)] : [],
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
