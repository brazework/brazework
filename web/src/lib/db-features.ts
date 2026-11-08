import { cache } from "react";
import { EVENT_COLS, EVENT_COLS_BASE, EVENT_WITH_HOST, EVENT_WITH_HOST_BASE } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

// Which optional database updates this Supabase project has had: supabase/club-events.sql,
// supabase/media.sql and supabase/invites.sql. The app runs on the same database before and after each one is applied, so
// pages ask for the new columns only when they exist, instead of failing. Probed once per request.
// 42703/PGRST204: no such column; 42P01/PGRST205: no such table; PGRST200: no such relationship.
const missing = (e: { code?: string } | null) => ["42703", "42P01", "PGRST200", "PGRST204", "PGRST205"].includes(e?.code ?? "");

export const dbFeatures = cache(async () => {
  const supabase = await createClient();
  const [ev, po, inv] = await Promise.all([
    supabase.from("events").select("community_id").limit(1),
    supabase.from("posts").select("media").limit(1),
    supabase.from("community_invites").select("code").limit(1),
  ]);
  return { clubEvents: !missing(ev.error), media: !missing(po.error), invites: !missing(inv.error) };
});

export async function eventCols(): Promise<string> {
  return (await dbFeatures()).clubEvents ? EVENT_COLS : EVENT_COLS_BASE;
}

export async function eventWithHost(): Promise<string> {
  return (await dbFeatures()).clubEvents ? EVENT_WITH_HOST : EVENT_WITH_HOST_BASE;
}

// Posts: every column ("*" includes media once media.sql has run), plus the author's photo then.
export async function postSelect(): Promise<string> {
  return (await dbFeatures()).media ? "*, author:profiles!posts_author_id_fkey(avatar_path)" : "*";
}
