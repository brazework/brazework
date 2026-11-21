import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// /sitemap.xml: the pages anyone can read without an account. Members' pages are signed-in only.
const PUBLIC_PAGES = ["/", "/pricing", "/plus", "/book", "/request-school", "/signup", "/privacy"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((p) => ({
    url: `${env.siteUrl}${p === "/" ? "" : p}`,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1 : 0.6,
  }));
}
