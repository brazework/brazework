import { dbFeatures } from "@/lib/db-features";
import { env } from "@/lib/env";
import type { createClient } from "@/lib/supabase/server";
import { eventMessage, milestoneMessage, sendDiscord } from "./discord";

// Automatic club announcements, run with after() so they never slow down the action that
// triggered them. They read the webhook with the acting officer's session (row-level security).

type DB = Awaited<ReturnType<typeof createClient>>;
type Row = { discord_webhook: string; discord_events: boolean; discord_milestones: boolean; discord_updates: boolean };

export async function clubDiscord(db: DB, clubId: string): Promise<Row | null> {
  if (!(await dbFeatures()).integrations) return null;
  const { data } = await db.from("club_integrations").select("discord_webhook, discord_events, discord_milestones, discord_updates").eq("community_id", clubId).maybeSingle();
  return data?.discord_webhook ? (data as Row) : null;
}

export async function announceEvent(db: DB, clubId: string, eventId: string, e: { title: string; description: string; starts_at: string; format: string; location: string }) {
  const d = await clubDiscord(db, clubId);
  if (!d?.discord_events) return;
  const { data: c } = await db.from("communities").select("name").eq("id", clubId).maybeSingle();
  await sendDiscord(d.discord_webhook, eventMessage(c?.name ?? "Club", { id: eventId, ...e }, env.siteUrl));
}

export async function announceMilestone(db: DB, milestoneId: string) {
  const { data } = await db.from("milestones").select("owner_id, community_id, community_name, title, status, project:projects(title), owner:profiles!milestones_owner_id_fkey(first_name, last_name)").eq("id", milestoneId).maybeSingle();
  const m = data as unknown as { owner_id: string; community_id: string; community_name: string; title: string; status: string; project: { title: string } | null; owner: { first_name: string; last_name: string } | null } | null;
  if (!m || m.status !== "verified") return;
  const d = await clubDiscord(db, m.community_id);
  if (!d?.discord_milestones) return;
  await sendDiscord(d.discord_webhook, milestoneMessage(m.community_name, { member: m.owner ? `${m.owner.first_name} ${m.owner.last_name}`.trim() : "A member", memberId: m.owner_id, title: m.title, project: m.project?.title ?? "" }, env.siteUrl));
}
