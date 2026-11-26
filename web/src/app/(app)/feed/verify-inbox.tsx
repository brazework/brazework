import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbFeatures } from "@/lib/db-features";
import { VerifyQueue, type QueueItem } from "../c/[id]/manage/verify";

// Signatures waiting on you, on Home, in plain sight (it used to be three clicks down: Club, your
// club, Manage, Verify). For officers (moderator and up): the milestones members have asked your
// clubs to verify, oldest first, each with its evidence and a Verify button right here. Your own
// work is left out: nobody signs their own (supabase/verification.sql). Null when the queue is
// empty or you're not an officer, so Home's "Needs you" knows whether to show at all.
export type VerifyInboxData = { items: (QueueItem & { community_id: string })[]; club: { id: string; name: string } };
const SHOWN = 5;

export async function loadVerifyInbox(supabase: SupabaseClient, me: string): Promise<VerifyInboxData | null> {
  const f = await dbFeatures();
  if (!f.milestones) return null;
  const { data: mine } = await supabase.from("community_members").select("community_id, communities(name)").eq("uid", me).in("role", ["moderator", "admin", "owner"]).limit(50);
  type Row = { community_id: string; communities: { name: string } | { name: string }[] | null };
  const clubs = ((mine ?? []) as unknown as Row[]).map((r) => ({ id: r.community_id, name: (Array.isArray(r.communities) ? r.communities[0]?.name : r.communities?.name) ?? "your club" }));
  if (!clubs.length) return null;
  const cols = (f.verification ? "dispute_note, escalated, revoked_reason, evidence_items, " : "") + (f.mcpMilestones ? "via, " : "") + "id, owner_id, community_id, title, detail, evidence, achieved_on, created_at, status, reviewer_name, review_note, project:projects(title, summary), owner:profiles!milestones_owner_id_fkey(first_name, last_name, headline)";
  const { data } = await supabase.from("milestones").select(cols).in("community_id", clubs.map((c) => c.id)).eq("status", "pending").neq("owner_id", me).order("created_at", { ascending: true }).limit(SHOWN + 1);
  const items = (data ?? []) as unknown as VerifyInboxData["items"];
  if (!items.length) return null;
  return { items, club: clubs.find((c) => c.id === items[0].community_id) ?? clubs[0] };
}

export function VerifyInbox({ data }: { data: VerifyInboxData }) {
  const { items, club } = data;
  return (
    <section aria-label="Signatures waiting on you">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-text">Sign what you saw <span className="font-normal text-muted">· asked of {club.name}</span></h3>
        <Link href={`/c/${club.id}/manage?tab=verify`} className="shrink-0 text-xs text-muted underline-offset-4 transition hover:text-text hover:underline">{items.length > SHOWN ? "See all" : "Past reviews"}</Link>
      </div>
      <VerifyQueue items={items.slice(0, SHOWN)} />
    </section>
  );
}
