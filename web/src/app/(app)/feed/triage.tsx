import { Inbox } from "lucide-react";
import Link from "next/link";
import { dbFeatures } from "@/lib/db-features";
import { triageHeading, type TriageClub } from "@/lib/draft-triage";
import { getViewer } from "@/lib/supabase/server";
import type { TriageDraft } from "@/lib/tool-drafts";
import { ReminderToggle } from "./triage-reminder";
import { TriageCard } from "./triage-card";

const SHOWN = 5;
const MEMBER_ROLES = ["owner", "admin", "moderator", "helper", "member"];

// "Your tools noticed N things" on Today (supabase/daily-triage.sql): the newest drafts your tools left,
// each decided in a tap without leaving the page. Nothing at all when none are waiting, or before the
// step has run. Row-level security keeps every query to your own rows.
export async function DraftTriage() {
  const { supabase, user } = await getViewer();
  if (!user || !(await dbFeatures()).dailyTriage) return null;
  const [drafts, mine, prefs] = await Promise.all([
    supabase.from("tool_drafts").select("id, kind, via, source, created_at, payload", { count: "exact" }).eq("status", "waiting").in("kind", ["post", "milestone"]).order("created_at", { ascending: false }).limit(SHOWN),
    supabase.from("community_members").select("role, communities(id, name)").eq("uid", user.id).in("role", MEMBER_ROLES).limit(50),
    supabase.from("email_prefs").select("daily_drafts").eq("user_id", user.id).maybeSingle(),
  ]);
  // Triage decides posts and milestones; the other kinds (RSVPs, replies, project edits from Ember and
  // the tools) wait on /drafts, where each has its own card.
  const list = (drafts.data ?? []) as TriageDraft[];
  const total = drafts.count ?? list.length;
  if (!list.length) return null;
  const clubs = ((mine.data ?? []) as unknown as { communities: TriageClub | null }[])
    .map((m) => m.communities).filter((c): c is TriageClub => !!c).sort((a, b) => a.name.localeCompare(b.name));
  const projectIds = [...new Set(list.map((d) => d.payload.project_id).filter((x): x is string => !!x))];
  const { data: projects } = projectIds.length ? await supabase.from("projects").select("id, title").in("id", projectIds) : { data: [] };
  const projectName = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const reminderOn = Boolean((prefs.data as { daily_drafts?: boolean } | null)?.daily_drafts);

  return (
    <section id="triage" aria-labelledby="triage-h" className="scroll-mt-24">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="triage-h" className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-faint uppercase"><Inbox className="size-3.5" />{triageHeading(total)}</h2>
        {total > list.length && <Link href="/drafts" className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">See all {total}</Link>}
      </div>
      <ul className="space-y-2" aria-label="Drafts from your tools">
        {list.map((d) => (
          <li key={d.id}><TriageCard draft={d} project={d.payload.project_id ? projectName.get(d.payload.project_id) ?? null : null} clubs={clubs} /></li>
        ))}
      </ul>
      {!reminderOn && !prefs.error && <ReminderToggle />}
    </section>
  );
}
