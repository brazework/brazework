import { BadgeCheck, Flame, Moon, PenLine } from "lucide-react";
import Link from "next/link";
import { dbFeatures } from "@/lib/db-features";
import { cn, requestTime } from "@/lib/forge";
import { buildStreak } from "@/lib/streak";
import { getViewer } from "@/lib/supabase/server";
import { NudgeButton } from "./nudge";

// The lead's week at a glance (Linear FIX-71): who posted this week, who's on a streak, whose milestones
// wait for verification, and who's gone quiet for 7+ days (for the lead to nudge personally).
// From club_member_activity() in supabase/chapters.sql (officers only); streaks use lib/streak.ts,
// the same rule as Home.
type Row = { uid: string; first_name: string; last_name: string; role: string; joined_at: string; last_active: string | null; weeks: string[]; pending: number };

export async function Roster({ cid }: { cid: string }) {
  if (!(await dbFeatures()).chapters) return null;
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("club_member_activity", { p_cid: cid, p_weeks: 9 });
  if (error || !data) return null;
  const now = requestTime();
  const weekAgo = now - 7 * 864e5;
  const people = (data as Row[]).map((r) => ({ ...r, name: `${r.first_name} ${r.last_name}`.trim(), streak: buildStreak(r.weeks.map((w) => Date.parse(`${w}T12:00:00Z`)), now) }));
  const posted = people.filter((p) => p.last_active && Date.parse(p.last_active) > weekAgo);
  const streaks = people.filter((p) => p.streak.weeks >= 2).sort((a, b) => b.streak.weeks - a.streak.weeks);
  const waiting = people.filter((p) => p.pending > 0).sort((a, b) => b.pending - a.pending);
  // Quiet: no post in 7+ days, and in the club for at least a week (a new member isn't "quiet").
  const quiet = people.filter((p) => (!p.last_active || Date.parse(p.last_active) <= weekAgo) && Date.parse(p.joined_at) <= weekAgo);

  const none = (t: string) => <p className="text-sm text-faint">{t}</p>;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-lg font-semibold tracking-tight">Your chapter this week</h2>
        <span className="text-xs text-faint">{posted.length} of {people.length} posted</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Block label="Posted this week" icon={<PenLine className="size-4 text-muted" />} n={posted.length}>
          {posted.length ? <p className="text-sm text-text-2">{posted.slice(0, 12).map((p) => p.name).join(", ")}{posted.length > 12 ? ` and ${posted.length - 12} more` : ""}</p> : none("Nobody yet this week. Post yours first.")}
        </Block>
        <Block label="On a streak" icon={<Flame className="size-4 text-orange-500" />} n={streaks.length}>
          {streaks.length ? (
            <ul className="flex flex-col gap-1">{streaks.slice(0, 6).map((p) => (
              <li key={p.uid} className="flex items-center gap-2 text-sm"><Link href={`/u/${p.uid}`} className="min-w-0 flex-1 truncate hover:underline">{p.name}</Link><span className="shrink-0 text-xs text-muted tabular-nums">{p.streak.weeks} weeks{p.streak.thisWeek ? "" : " · due"}</span></li>
            ))}</ul>
          ) : none("Two weeks in a row starts a streak.")}
        </Block>
        <Block label="Waiting for verification" icon={<BadgeCheck className="size-4 text-ok" />} n={waiting.reduce((a, p) => a + p.pending, 0)} tone="bg-accent-grad text-on-accent">
          {waiting.length ? (
            <>
              <ul className="flex flex-col gap-1">{waiting.slice(0, 6).map((p) => (
                <li key={p.uid} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="shrink-0 text-xs text-muted tabular-nums">{p.pending}</span></li>
              ))}</ul>
              <Link href={`/c/${cid}/manage?tab=verify`} className="mt-2 inline-flex h-8 items-center rounded-full bg-text px-3 text-xs font-semibold text-surface">Review them</Link>
            </>
          ) : none("Nothing waiting.")}
        </Block>
        <Block label="Quiet for 7+ days" icon={<Moon className="size-4 text-muted" />} n={quiet.length}>
          {quiet.length ? (
            <ul className="flex flex-col gap-1.5">{quiet.slice(0, 8).map((p) => (
              <li key={p.uid} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-xs text-faint">{p.last_active ? `· last posted ${Math.floor((now - Date.parse(p.last_active)) / 864e5)} days ago` : "· hasn't posted yet"}</span></span>
                <NudgeButton uid={p.uid} first={p.first_name} />
              </li>
            ))}</ul>
          ) : none("Everyone's been active this week.")}
        </Block>
      </div>
    </div>
  );
}

// One of the four boxes.
function Block({ label, icon, n, tone, children }: { label: string; icon: React.ReactNode; n: number; tone?: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="rounded-3xl border border-line bg-surface p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{icon} {label} <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs tabular-nums", n ? tone ?? "bg-surface-2 text-text" : "bg-surface-2 text-faint")}>{n}</span></h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
