"use server";
import { dbFeatures } from "@/lib/db-features";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";

// Who you can @mention: people you follow first, then anyone on Brazework whose name matches.
// Who actually gets notified is decided by the database (supabase/mentions.sql).

export type MentionPerson = { id: string; first: string; last: string; headline: string; avatar: string | null; follows: boolean };

export async function mentionSuggestions(query: string): Promise<MentionPerson[]> {
  const { supabase, user } = await getViewer();
  if (!user) return [];
  const { media, mentions } = await dbFeatures();
  if (!mentions) return [];
  const words = query.normalize("NFKC").split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, "")).filter(Boolean).slice(0, 2);
  const { data: f } = await supabase.from("follows").select("target").eq("follower", user.id).order("created_at", { ascending: false }).limit(500);
  const followed = ((f ?? []) as { target: string }[]).map((r) => r.target);
  const cols = `id, first_name, last_name, headline${media ? ", avatar_path" : ""}`;
  let q = supabase.from("profiles").select(cols).eq("onboarded", true).neq("id", user.id);
  if (words.length) for (const w of words) q = q.or(`first_name.ilike.${w}*,last_name.ilike.${w}*`);
  else if (followed.length) q = q.in("id", followed.slice(0, 50));
  else return [];
  const { data } = await q.limit(30);
  type Row = { id: string; first_name: string; last_name: string; headline: string; avatar_path?: string | null };
  const mine = new Set(followed);
  return ((data ?? []) as unknown as Row[])
    .filter((r) => `${r.first_name} ${r.last_name}`.trim())
    .map((r) => ({ id: r.id, first: r.first_name, last: r.last_name, headline: r.headline, avatar: avatarSrc(r), follows: mine.has(r.id) }))
    .sort((a, b) => Number(b.follows) - Number(a.follows))
    .slice(0, 6);
}
