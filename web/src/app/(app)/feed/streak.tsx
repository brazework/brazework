import { ArrowRight, BadgeCheck, Eye, Flame } from "lucide-react";
import Link from "next/link";
import { cn, requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop, type Loop } from "@/lib/week-load";

// Your streak (Linear FIX-67): the weekly loop in one small card, not a banner. Build streak with its
// 8-week strip, club-verified milestones, who looked, and the one next step. On wide screens it tops
// the right rail; on phones (no rail) it's a single line above the composer.
const sentence = (l: Loop) => {
  const company = l.viewers?.companies[0];
  const views = l.viewers?.total ?? 0;
  return company ? `${company} looked at your profile` : views ? `${views} ${views === 1 ? "person" : "people"} looked at your profile this week` : null;
};

export async function StreakCard() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const l = await loadLoop(supabase, user.id, requestTime());
  const next = l.steps.find((s) => s.state === "now")?.cta ?? null;
  const looked = sentence(l);
  return (
    <section aria-label="Your streak" className="glass-card rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", l.streak.weeks ? "bg-orange-500/12 text-orange-500" : "bg-surface-2 text-faint")}><Flame className={cn("size-5", l.streak.weeks && "fill-orange-500/25")} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight">{l.streak.weeks ? `${l.streak.weeks}-week streak` : "No streak yet"}</p>
          <p className="text-xs text-muted">{l.streak.thisWeek ? "You've posted this week" : l.streak.weeks ? "Post this week to keep it" : "Post this week to start one"}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-[3px]" aria-hidden="true">
        {l.recent.map((on, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", on ? "bg-orange-500" : "bg-line")} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2"><BadgeCheck className="size-3.5 text-ok" /><b className="tabular-nums">{l.verified}</b> verified</span>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2"><Eye className="size-3.5 text-muted" /><b className="tabular-nums">{l.viewers?.total ?? 0}</b> views this week</span>
      </div>
      {looked && <p className="mt-3 text-xs text-text-2">{looked}</p>}
      {next && <Link href={next.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline">{next.label} <ArrowRight className="size-3.5" /></Link>}
    </section>
  );
}

// Phones: the same facts in one tappable line.
export function StreakLine({ l }: { l: Loop }) {
  const next = l.steps.find((s) => s.state === "now")?.cta ?? null;
  return (
    <Link href={next?.href ?? "/profile"} aria-label="Your streak" className="mb-3 flex items-center gap-2 overflow-hidden rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5 text-sm">
      <Flame className={cn("size-4 shrink-0", l.streak.weeks ? "fill-orange-500/25 text-orange-500" : "text-faint")} />
      <span className="shrink-0 font-semibold">{l.streak.weeks ? `${l.streak.weeks}-week streak` : "Start a streak"}</span>
      <span className="shrink-0 text-faint">·</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-muted"><BadgeCheck className="size-3.5 text-ok" />{l.verified}</span>
      {next && <span className="ml-auto inline-flex min-w-0 items-center gap-1 truncate text-xs font-medium">{next.label}<ArrowRight className="size-3 shrink-0" /></span>}
    </Link>
  );
}
