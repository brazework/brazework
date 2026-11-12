import { ArrowRight, BadgeCheck, ChevronDown, Eye, Flame } from "lucide-react";
import Link from "next/link";
import { cn, requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop, type Loop } from "@/lib/week-load";

// Your week (Linear FIX-67, FIX-92): one card for where you stand. Your build streak (weeks, not days)
// with its 8-week strip, club-verified milestones, profile views, then what's worth doing this week.
// It tops the rail on wide screens; on phones (no rail) the same card sits above the composer, folded
// to one line until you open it. One card, not a streak card plus a week card saying the same things.

export async function YourWeekCard() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const l = await loadLoop(supabase, user.id, requestTime());
  return (
    <section aria-label="Your week" className="glass-card rounded-2xl p-4">
      <Header l={l} />
      <Body l={l} />
    </section>
  );
}

// Phones: the same card, folded to its header line.
export function YourWeekFold({ l }: { l: Loop }) {
  const todo = l.week.filter((w) => w.tone === "todo").length;
  return (
    <details className="group glass-card mb-3 rounded-2xl [&::-webkit-details-marker]:hidden">
      <summary aria-label="Your week" className="flex cursor-pointer list-none items-center gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
        <StreakIcon weeks={l.streak.weeks} small />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{l.streak.weeks ? `${l.streak.weeks}-week streak` : "Your week"}</span>
          <span className="block truncate text-xs text-muted">{l.verified} verified · {l.viewers?.total ?? 0} views this week{todo ? ` · ${todo} to do` : ""}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-faint transition group-open:rotate-180" />
      </summary>
      <div className="px-3.5 pb-3.5"><Body l={l} /></div>
    </details>
  );
}

function StreakIcon({ weeks, small }: { weeks: number; small?: boolean }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-lg", small ? "size-8" : "size-9", weeks ? "bg-orange-500/12 text-orange-500" : "bg-surface-2 text-faint")}>
      <Flame className={cn("size-[18px]", weeks && "fill-orange-500/25")} />
    </span>
  );
}

function Header({ l }: { l: Loop }) {
  return (
    <div className="flex items-center gap-3">
      <StreakIcon weeks={l.streak.weeks} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-tight">{l.streak.weeks ? `${l.streak.weeks}-week streak` : "No streak yet"}</p>
        <p className="text-xs text-muted">{l.streak.thisWeek ? "You've posted this week" : l.streak.weeks ? "Post this week to keep it" : "Post this week to start one"}</p>
      </div>
    </div>
  );
}

function Body({ l }: { l: Loop }) {
  const next = l.steps.find((s) => s.state === "now")?.cta ?? null;
  return (
    <>
      <div className="mt-3 flex gap-[3px]" aria-hidden="true">
        {l.recent.map((on, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", on ? "bg-orange-500" : "bg-line")} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Link href="/profile#projects" className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2 transition hover:bg-hover"><BadgeCheck className="size-3.5 text-ok" /><b className="tabular-nums">{l.verified}</b> verified</Link>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-2 transition hover:bg-hover"><Eye className="size-3.5 text-muted" /><b className="tabular-nums">{l.viewers?.total ?? 0}</b> profile views</Link>
      </div>
      {l.week.length > 0 && (
        <ul className="mt-3 flex flex-col border-t border-line pt-2">
          {l.week.map((w) => (
            <li key={w.id}>
              <Link href={w.href} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-sm transition hover:bg-hover">
                <span className={cn("size-1.5 shrink-0 rounded-full", w.tone === "todo" ? "bg-accent" : w.tone === "nudge" ? "bg-ok" : "bg-line-strong")} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-text-2 group-hover:text-text">{w.text}</span>
                {w.action && <span className="shrink-0 text-xs font-medium text-text">{w.action} →</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {next && <Link href={next.href} className="mt-2 inline-flex items-center gap-1 px-1.5 text-sm font-medium hover:underline">{next.label} <ArrowRight className="size-3.5" /></Link>}
    </>
  );
}
