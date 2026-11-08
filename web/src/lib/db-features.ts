import { cache } from "react";
import { EVENT_COLS, EVENT_COLS_BASE, EVENT_WITH_HOST, EVENT_WITH_HOST_BASE } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

// Which optional database updates this Supabase project has had: supabase/club-events.sql and
// supabase/media.sql. The app runs on the same database before and after each one is applied, so
// pages ask for the new columns only when they exist, instead of failing. Probed once per request.
const missing = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST200" || e?.code === "PGRST204";

export const dbFeatures = cache(async () => {
  const supabase = await createClient();
  const [ev, po] = await Promise.all([
    supabase.from("events").select("community_id").limit(1),
    supabase.from("posts").select("media").limit(1),
  ]);
  return { clubEvents: !missing(ev.error), media: !missing(po.error) };
});

export async function eventCols(): Promise<string> {
  return (await dbFeatures()).clubEvents ? EVENT_COLS : EVENT_COLS_BASE;
}

export async function eventWithHost(): Promise<string> {
  return (await dbFeatures()).clubEvents ? EVENT_WITH_HOST : EVENT_WITH_HOST_BASE;
}
