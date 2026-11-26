import { GitMerge, MessageSquare, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { List, ListRow } from "@/components/app/list";
import { Seal } from "@/components/app/verified-seal";
import { GoalCard, GoalMark } from "@/components/app/goal-card";
import { Ember } from "@/components/ember/ember";
import { Avatar } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { requestTime, timeAgo } from "@/lib/forge";
import { loadGoal, loadRecord } from "@/lib/goal-load";
import { avatarSrc } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";
import type { ToolDraft } from "@/lib/tool-drafts";
import { DraftTriage } from "./triage";
import { loadVerifyInbox, VerifyInbox } from "./verify-inbox";

// Home's stream (section redesign, Nov 2026): one column, in the order you'd act on it.
//   1. what your tools noticed (drafts they left you: the daily triage, triage.tsx)
//   2. what needs you (signatures to give, message requests, connection invites)
//   3. what your clubs shipped (work their officers signed this week)
//   then your goal: the check-in.
// Each group is a quiet list on one spine; a group with nothing in it doesn't show, except the
// clubs group, whose empty state invites the first step. Every query here is your own rows
// (row-level security), loaded together in one round.
const WEEK_MS = 7 * 864e5;
const TOOLS_SHOWN = 3;
const SHIPPED_SHOWN = 4;

type Shipped = { id: string; title: string; reviewed_at: string; community_id: string | null; community_name: string; vouched_by?: string | null; project: { id: string; title: string; private: boolean } | null; owner: { id: string; first_name: string; last_name: string; avatar_path?: string | null } | null };

export async function HomeStream() {
  const { supabase, user, profile } = await getViewer();
  if (!user) return null;
  const f = await dbFeatures();
  const now = requestTime();
  const { data: joined } = await supabase.from("community_members").select("community_id").eq("uid", user.id).limit(200);
  const cids = (joined ?? []).map((j) => j.community_id as string);
  const [drafts, requests, invites, verify, shipped, goal, record] = await Promise.all([
    // Drafts your tools left (supabase/mcp-workflows.sql); none before that step.
    f.mcpWorkflows && !f.dailyTriage ? supabase.from("tool_drafts").select("id, kind, via, source, created_at, payload", { count: "exact" }).eq("status", "waiting").order("created_at", { ascending: false }).limit(TOOLS_SHOWN) : Promise.resolve({ data: [], count: 0 }),
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "request").neq("started_by", user.id),
    supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", user.id).eq("status", "pending"),
    loadVerifyInbox(supabase, user.id),
    f.milestones && cids.length
      ? supabase.from("milestones").select(`id, title, reviewed_at, community_id, community_name${f.vouches ? ", vouched_by" : ""}, project:projects(id, title, private), owner:profiles!milestones_owner_id_fkey(id, first_name, last_name${f.media ? ", avatar_path" : ""})`)
        .eq("status", "verified").in("community_id", cids).gt("reviewed_at", new Date(now - WEEK_MS).toISOString()).order("reviewed_at", { ascending: false }).limit(SHIPPED_SHOWN + 4)
      : Promise.resolve({ data: [] }),
    f.goals ? loadGoal(supabase, user.id) : Promise.resolve(null),
    f.goals ? loadRecord(supabase, user.id) : Promise.resolve(null),
  ]);

  const toolDrafts = (drafts.data ?? []) as ToolDraft[];
  const toolCount = drafts.count ?? toolDrafts.length;
  const nRequests = requests.count ?? 0, nInvites = invites.count ?? 0;
  const ships = ((shipped.data ?? []) as unknown as Shipped[]).filter((m) => m.project && !m.project.private && m.owner).slice(0, SHIPPED_SHOWN);
  const needsYou = nRequests > 0 || nInvites > 0 || !!verify;
  // Your goal shows in full once it's set; until then it's one row that opens the picker (Home asks
  // one thing at a time: the band or the first-build box asks for the work).
  const goalSet = goal?.status === "active" || goal?.status === "met";

  return (
    <div aria-label="Your day" role="group" className="flex flex-col gap-7">
      {/* Once daily-triage.sql has run, the drafts are decided right here, a tap each (triage.tsx). */}
      {f.dailyTriage && <DraftTriage node={<Ember size={18} />} />}
      {toolDrafts.length > 0 && (
        <Group label={`Your tools noticed ${toolCount === 1 ? "1 thing" : `${toolCount} things`}`} node={<Ember size={18} />}
          more={toolCount > toolDrafts.length ? <Link href="/drafts" className={moreCls}>See all {toolCount}</Link> : null}>
          <List label="Drafts from your tools">
            {toolDrafts.map((d) => (
              <ListRow key={d.id} href="/drafts" leading={<Tile><GitMerge /></Tile>} title={draftTitle(d)}
                meta={<>{d.kind === "milestone" ? "Milestone" : "Post"} drafted via {d.via || "your tools"} <span suppressHydrationWarning>{timeAgo(d.created_at)}</span></>}
                trailing={<Link href="/drafts" tabIndex={-1} className={actionCls}>Review</Link>} />
            ))}
          </List>
        </Group>
      )}

      {needsYou && (
        <Group label="Needs you" node={<span className="block size-2 rounded-full bg-text" />}>
          <div className="flex flex-col gap-4">
            {(nRequests > 0 || nInvites > 0) && (
              <List label="Requests">
                {nRequests > 0 && <ListRow href="/messages" leading={<Tile><MessageSquare /></Tile>} title={`${nRequests} ${nRequests === 1 ? "person wants" : "people want"} to message you`} meta="Accept to start the conversation" trailing={<Link href="/messages" tabIndex={-1} className={actionCls}>Open</Link>} />}
                {nInvites > 0 && <ListRow href="/network" leading={<Tile><UserPlus /></Tile>} title={`${nInvites} connection ${nInvites === 1 ? "invite" : "invites"}`} meta="People who'd like to see your work" trailing={<Link href="/network" tabIndex={-1} className={actionCls}>See</Link>} />}
              </List>
            )}
            {verify && <VerifyInbox data={verify} />}
          </div>
        </Group>
      )}

      {/* What was signed this week. With nothing signed yet it says how to get there, but only for a
          member whose next step above isn't already saying it (less clutter, Nov 21): someone with
          projects is shown "ask someone who saw it" there, so the empty box would repeat it. */}
      {(ships.length > 0 || (!cids.length && profile?.account_type !== "professional")) && <Group label={profile?.account_type === "professional" && !cids.length ? "Signed this week" : "Your clubs shipped this week"} node={<Seal size={18} />}
        more={ships.length ? <Link href="/communities" className={moreCls}>Your clubs</Link> : null}>
        {ships.length ? (
          <List label="Signed this week in your clubs">
            {ships.map((m) => (
              <ListRow key={m.id} href={`/projects/${m.project!.id}`} leading={<Avatar first={m.owner!.first_name} last={m.owner!.last_name} size={32} src={avatarSrc(m.owner)} />}
                title={m.title} meta={`${`${m.owner!.first_name} ${m.owner!.last_name}`.trim()} on ${m.project!.title}`}
                trailing={<span className="inline-flex items-center gap-1.5 text-xs font-medium text-ok"><Seal size={16} /><span className="hidden sm:inline">{m.vouched_by ? "Signed" : `Signed by ${m.community_name}`}</span></span>} />
            ))}
          </List>
        ) : (
          <Invite cids={cids.length} working={profile?.account_type === "professional"} />
        )}
      </Group>}

      {record && (goalSet ? (
        <Group label="Where you're headed" node={<GoalMark />}>
          <GoalCard compact goal={goal} record={record} profileId={user.id} accountType={profile?.account_type} />
        </Group>
      ) : (
        <details className="group/goal glass-card rounded-2xl">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden sm:px-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2"><GoalMark className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold tracking-tight">Where are you headed?</span>
              <span className="block text-sm text-muted">Pick a goal, and your next steps come from your real work.</span>
            </span>
            <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition group-open/goal:hidden hover:border-line-strong">Set a goal</span>
            <span className="hidden shrink-0 text-xs text-muted group-open/goal:inline">Close</span>
          </summary>
          <div className="border-t border-line p-2 sm:p-3"><GoalCard compact goal={goal} record={record} profileId={user.id} accountType={profile?.account_type} /></div>
        </details>
      ))}
    </div>
  );
}

// The row's one action; the whole row is the same link, so this one is skipped by Tab.
const actionCls = "hidden rounded-md border border-line px-2.5 py-1 text-xs font-medium text-text transition hover:border-line-strong sm:inline-block";
const moreCls = "shrink-0 text-xs text-muted underline-offset-4 transition hover:text-text hover:underline";

const draftTitle = (d: ToolDraft) => {
  const p = d.payload;
  const t = (p.title || p.body || d.source || "A draft").toString();
  return t.length > 90 ? `${t.slice(0, 89)}…` : t;
};

// A group in Home's stream (redesign 2026-11): a small heading with its mark, then its rows. No
// timeline spine: the order already says what comes first.
function Group({ label, node, more, children }: { label: string; node: React.ReactNode; more?: React.ReactNode; children: React.ReactNode }) {
  const id = `home-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      {/* A clear section title (2026-11-26, Home redesign): each group says what it's for. */}
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id={id} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-text"><span aria-hidden="true" className="grid w-4 place-items-center text-muted [&_svg]:size-4">{node}</span>{label}</h2>
        {more}
      </div>
      {children}
    </section>
  );
}

// The picture at the start of a row that has no person in it.
function Tile({ children }: { children: React.ReactNode }) {
  return <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted [&_svg]:size-4">{children}</span>;
}

// Nothing signed in your clubs this week: the first step toward it, not a blank.
// A working member in no club has nobody to join: the work they get signed is what shows here.
function Invite({ cids, working = false }: { cids: number; working?: boolean }) {
  const solo = working && !cids;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 glass-card rounded-xl px-4 py-3.5">
      <p className="min-w-0 flex-1 basis-56 text-sm text-muted">
        {cids ? "Nothing signed in your clubs yet this week. Log a result and ask an officer who saw it." : solo ? "Work you get signed shows up here. Log a result and ask whoever saw it: a coworker outside the project, a client, a mentor." : "Join your club, and the work its officers sign shows up here, yours included."}
      </p>
      <Link href={cids || solo ? "/projects" : "/communities?tab=discover"} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-text px-3 text-xs font-semibold text-bg transition hover:opacity-90">
        <Sparkles className="size-3.5" />{cids ? "Log a milestone" : solo ? "Log a result" : "Find your club"}
      </Link>
    </div>
  );
}

// The stream's place while it loads: the spine and the clubs group, which always shows.
export function StreamSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8">
      <div>
        <div className="mb-2.5 h-5 w-52 shimmer rounded-md" />
        <div className="h-[58px] shimmer rounded-xl" />
      </div>
    </div>
  );
}
