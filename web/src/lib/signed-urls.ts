import type { SupabaseClient } from "@supabase/supabase-js";

// Signed links to private Storage files, kept the same between renders (Linear FIX-75). A fresh link
// on every render (each page view, every router.refresh()) is a new URL to the browser and to Vercel's
// image cache, so the whole file downloads again from Supabase each time. Here a link lives 2 hours and
// is handed out again while it has more than 30 minutes left, so repeat views reuse the cached copy.
//
// The cache holds only links the server already signed for a member who could read the file (Storage
// RLS checks at signing, and pages only ask for files their own query returned), keyed by bucket and
// path. A link grants exactly what it did before; it just isn't replaced every render. Per server
// instance, so it resets on deploy.
const TTL = 2 * 60 * 60;
const REUSE_ABOVE = 30 * 60 * 1000;
const MAX = 2000;
const cache = new Map<string, { url: string; until: number }>();

export async function signedUrls(supabase: SupabaseClient, bucket: string, paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const out = new Map<string, string>();
  const need: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(`${bucket}/${p}`);
    if (hit && hit.until - now > REUSE_ABOVE) out.set(p, hit.url);
    else need.push(p);
  }
  if (need.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(need, TTL);
    for (const s of data ?? []) {
      if (!s.signedUrl || !s.path) continue;
      out.set(s.path, s.signedUrl);
      cache.set(`${bucket}/${s.path}`, { url: s.signedUrl, until: now + TTL * 1000 });
    }
    // Oldest entries out first once it's full (Map keeps insertion order).
    for (const k of cache.keys()) { if (cache.size <= MAX) break; cache.delete(k); }
  }
  return out;
}
