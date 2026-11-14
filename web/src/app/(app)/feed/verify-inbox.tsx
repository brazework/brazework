import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { VerifyQueue, type QueueItem } from "../c/[id]/manage/verify";

// Signatures waiting on you, on Today, in plain sight (it used to be three clicks down: Club, your
// club, Manage, Verify). For officers (moderator and up): the milestones members have asked your
// clubs to verify, oldest first, each with its evidence and a Verify button right here. Your own
// work is left out: nobody signs their own (supabase/verification.sql). Nothing at all when the
// queue is empty or you're not an officer.
export async function VerifyInbox() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const f = await dbFeatures();
  if (!f.milestones) return null;
  const { data: mine } = await supabase.from("community_members").select("community_id, communities(name)").eq("uid", user.id).in("role", ["moderator", "admin", "owner"]).limit(50);
  type Row = { community_id: string; communities: { name: string } | { name: string }[] | null };
  const clubs = ((mine ?? []) as unknown as Row[]).map((r) => ({ id: r.community_id, name: (Array.isArray(r.communities) ? r.communities[0]?.name : r.communities?.name) ?? "your club" }));
  if (!clubs.length) return null;
  const cols = (f.verification ? "dispute_note, escalated, revoked_reason, evidence_items, " : "") + (f.mcpMilestones ? "via, " : "") + "id, owner_id, community_id, title, detail, evidence, achieved_on, created_at, status, reviewer_name, review_note, project:projects(title, summary), owner:profiles!milestones_owner_id_fkey(first_name, last_name, headline)";
  const { data } = await supabase.from("milestones").select(cols).in("community_id", clubs.map((c) => c.id)).eq("status", "pending").neq("owner_id", user.id).order("created_at", { ascending: true }).limit(6);
  const items = (data ?? []) as unknown as (QueueItem & { community_id: string })[];
  if (!items.length) return null;
  const SHOWN = 5, first = clubs.find((c) => c.id === items[0].community_id) ?? clubs[0];
  return (
    <section aria-label="Signatures waiting on you" className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight"><ShieldCheck className="size-4" /> Signatures waiting on you</h2>
        <Link href={`/c/${first.id}/manage?tab=verify`} className="text-xs font-medium text-muted transition hover:text-text">{items.length > SHOWN ? "See all" : "Past reviews"} →</Link>
      </div>
      <p className="mb-3 text-xs text-muted">Members asked your club to sign these. Verify what you saw happen; decline with a reason if you didn&apos;t.</p>
      <VerifyQueue items={items.slice(0, SHOWN)} />
    </section>
  );
}
