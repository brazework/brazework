import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// /robots.txt. Only production is indexed: preview and staging copies ask every crawler to stay out.
// Signed-in pages already redirect a crawler to /login, and one-off links (signing, reports, proofs)
// carry their own noindex, so this only keeps crawlers off machinery that has nothing to read.
export default function robots(): MetadataRoute.Robots {
  const live = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";
  if (!live) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/oauth/", "/dev/", "/vouch/", "/r/", "/join/"] },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
