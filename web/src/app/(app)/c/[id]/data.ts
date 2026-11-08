import { redirect } from "next/navigation";
import { cache } from "react";
import { COMMUNITY_COLS, normalizeAutomod, type Community, type Member } from "@/lib/communities";
import { getViewer } from "@/lib/supabase/server";

// One community plus who you are in it, loaded once per request (page, metadata and tabs share it).
// Row-level security decides what comes back; this never widens access.
export const loadCommunity = cache(async (cid: string) => {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  const [c, m, r] = await Promise.all([
    supabase.from("communities").select(COMMUNITY_COLS).eq("id", cid).maybeSingle(),
    supabase.from("community_members").select("*").eq("community_id", cid).eq("uid", user.id).maybeSingle(),
    supabase.from("community_requests").select("uid").eq("community_id", cid).eq("uid", user.id).maybeSingle(),
  ]);
  const community = c.data ? ({ ...c.data, automod: normalizeAutomod(c.data.automod) } as Community) : null;
  return {
    supabase,
    user,
    profile,
    community,
    me: (m.data as Member | null) ?? null,
    requested: !!r.data,
    error: c.error ?? m.error ?? null,
  };
});
