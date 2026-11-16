import { cache } from "react";
import { dbFeatures } from "@/lib/db-features";
import type { BadgeKey } from "@/lib/places";
import { getViewer } from "@/lib/supabase/server";

// What's waiting for you, as the counts shown across the app: on the sidebar's places and on the
// place tabs inside them (supabase/activity.sql, messages.sql). Remembered for one render (React
// cache), so the sidebar and the tab row ask the database once between them. Row-level security
// limits every count to your own rows.
export type Badges = Record<BadgeKey, number>;

export const loadBadges = cache(async (): Promise<Badges | null> => {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { groupChats, milestones } = await dbFeatures();
  const [n, m, i, g, led] = await Promise.all([
    supabase.rpc("unread_notifications"),
    supabase.rpc("unread_conversations"),
    supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", user.id).eq("status", "pending"),
    groupChats ? supabase.rpc("unread_chats") : Promise.resolve({ data: 0 }),
    // The clubs you're an officer of: their members' results are yours to sign.
    milestones ? supabase.from("community_members").select("community_id").eq("uid", user.id).in("role", ["moderator", "admin", "owner"]).limit(50) : Promise.resolve({ data: [] }),
  ]);
  // Results waiting on your signature (never your own: nobody signs their own work). Only officers pay for this query.
  const clubs = ((led.data ?? []) as { community_id: string }[]).map((r) => r.community_id);
  const signing = clubs.length ? (await supabase.from("milestones").select("*", { count: "exact", head: true }).in("community_id", clubs).eq("status", "pending").neq("owner_id", user.id)).count ?? 0 : 0;
  return { notifications: Number(n.data) || 0, messages: (Number(m.data) || 0) + (Number(g.data) || 0), invites: i.count ?? 0, signing };
});
