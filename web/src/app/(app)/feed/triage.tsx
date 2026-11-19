import Link from "next/link";
import { dbFeatures } from "@/lib/db-features";
import { triageHeading, waitingElsewhere, type TriageClub } from "@/lib/draft-triage";
import { getViewer } from "@/lib/supabase/server";
import type { TriageDraft } from "@/lib/tool-drafts";
import { ReminderToggle } from "./triage-reminder";
import { TriageCard } from "./triage-card";

const SHOWN = 5;
const MEMBER_ROLES = ["owner", "admin", "moderator", "helper", "member"];

// "Your tools noticed N things" on Today (supabase/daily-triage.sql): the newest drafts your tools left,
// each decided in a tap without leaving the page. Nothing at all when none are waiting, or before the
// step has run. Row-level security keeps every query to your own rows.
// `node`: its marker on Home's spine (feed/stream.tsx), so it reads as the stream's first group.
export async function DraftTriage({ node }: { node?: React.ReactNode } = {}) {
  const { supabase, user } = await getViewer();
  if (!user || !(await dbFeatures()).dailyTriage) return null;
  const [drafts, others, mine, prefs] = await Promise.all([
    supabase.from("tool_drafts").select("id, kind, via, source, created_at, payload", { count: "exact" }).eq("status", "waiting").in("kind", ["post", "milestone"]).order("created_at", { ascending: false }).limit(SHOWN),
    supabase.from("tool_drafts").select("kind, via, payload", { count: "exact" }).eq("status", "waiting").not("kind", "in", "(post,milestone)").order("created_at", { ascending: false }).limit(1),
    supabase.from("community_members").select("role, communities(id, name)").eq("uid", user.id).in("role", MEMBER_ROLES).limit(50),
    supabase.from("email_prefs").select("daily_drafts").eq("user_id", user.id).maybeSingle(),
  ]);
  // Triage decides posts and milestones; the other kinds (a project, an RSVP, a reply from Ember and
  // the tools) wait on /drafts, where each has its own card. One line here says they're waiting.
  const list = (drafts.data ?? []) as TriageDraft[];
  const total = drafts.count ?? list.length;
  const rest = (others.data ?? []) as { kind: string; via: string; payload: Record<string, unknown> }[];
  const restCount = others.error ? 0 : others.count ?? rest.length;
  if (!list.length && !restCount) return null;
  const newest = rest[0];
  const newestTitle = newest ? [newest.payload?.title, newest.payload?.project_title, newest.payload?.name].find((x): x is string => typeof x === "string" && !!x.trim()) ?? null : null;
  const clubs = ((mine.data ?? []) as unknown as { communities: TriageClub | null }[])
    .map((m) => m.communities).filter((c): c is TriageClub => !!c).sort((a, b) => a.name.localeCompare(b.name));
  const projectIds = [...new Set(list.map((d) => d.payload.project_id).filter((x): x is string => !!x))];
  const { data: projects } = projectIds.length ? await supabase.from("projects").select("id, title").in("id", projectIds) : { data: [] };
  const projectName = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const reminderOn = Boolean((prefs.data as { daily_drafts?: boolean } | null)?.daily_drafts);

  return (
    <section id="triage" aria-labelledby="triage-h" className="relative scroll-mt-24">
      {node && <span aria-hidden="true" className="absolute top-0.5 -left-7 grid w-[18px] place-items-center sm:-left-8">{node}</span>}
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 id="triage-h" className="text-[15px] font-semibold tracking-tight text-text">{triageHeading(total + restCount)}</h2>
        {total > list.length && <Link href="/drafts" className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">See all {total}</Link>}
      </div>
      {list.length > 0 && (
        <ul className="space-y-2" aria-label="Drafts from your tools">
          {list.map((d) => (
            <li key={d.id}><TriageCard draft={d} project={d.payload.project_id ? projectName.get(d.payload.project_id) ?? null : null} clubs={clubs} /></li>
          ))}
        </ul>
      )}
      {restCount > 0 && (
        <Link href="/drafts" className={`${list.length ? "mt-2 " : ""}flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition hover:bg-hover`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text">{waitingElsewhere(restCount, newest ? { kind: newest.kind, title: newestTitle } : null)}</span>
            <span className="block text-xs text-muted">{restCount === 1 ? `From ${newest?.via || "your tools"}, waiting for your OK` : "Waiting for your OK"}</span>
          </span>
          <span className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-medium text-text">Review</span>
        </Link>
      )}
      {!reminderOn && !prefs.error && <ReminderToggle />}
    </section>
  );
}
