import { ArrowRight, Check, Eye, Flame } from "lucide-react";
import Link from "next/link";
import { cn, requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";

// The weekly loop at the top of Home (Linear FIX-67), for members past their first five minutes:
// the one thing worth doing this week, the build streak with its last eight weeks, and who looked.
// Everything comes from the member's real rows; nothing is shown that isn't true.
export async function WeekLoop() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { goal, streak, recent, viewers } = await loadLoop(supabase, user.id, requestTime());
  const looked = viewers?.companies.length
    ? `${viewers.companies[0]}${viewers.companies.length > 1 ? ` +${viewers.companies.length - 1}` : ""} viewed your profile`
    : viewers && viewers.total > 0 ? `${viewers.total} ${viewers.total === 1 ? "person" : "people"} viewed your profile` : "";
  return (
    <section aria-label="This week's goal" className="glass-card mb-4 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-3.5">
        {/* The goal ring: fills when this week's goal is done. */}
        <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-full", goal.done ? "bg-accent-grad text-on-accent shadow-[0_8px_20px_-10px_var(--accent)]" : "border-2 border-dashed border-line-strong text-faint")} aria-hidden="true">
          {goal.done ? <Check className="size-5" /> : <span className="size-2 rounded-full bg-accent" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium tracking-wide text-faint uppercase">{goal.done ? "This week · done" : "This week"}</div>
          <div className="text-sm font-semibold sm:truncate">{goal.text}</div>
        </div>
        {goal.action && (
          <Link href={goal.href} className="bg-accent-grad inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-on-accent transition hover:opacity-90 active:scale-95">
            {goal.action} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
        {/* The streak: weeks in a row with work shown, and the last eight weeks at a glance. */}
        <span className="inline-flex items-center gap-2" aria-label={streak.weeks ? `${streak.weeks}-week build streak` : "No build streak yet"}>
          <Flame className={cn("size-4", streak.weeks ? "text-orange-500" : "text-faint")} />
          <span className="font-medium text-text">{streak.weeks ? `${streak.weeks}-week build streak` : "Start a build streak"}</span>
          <span className="flex items-end gap-[3px]" aria-hidden="true">
            {recent.map((on, i) => <span key={i} className={cn("w-1.5 rounded-full", on ? "h-3 bg-accent-grad" : "h-1.5 bg-line-strong", i === recent.length - 1 && !on && "h-2.5 border border-dashed border-line-strong bg-transparent")} />)}
          </span>
          {streak.weeks > 0 && !streak.thisWeek && <span className="text-faint">· post this week to keep it</span>}
        </span>
        {looked && (
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-text-2 transition hover:text-text"><Eye className="size-3.5" /> {looked}</Link>
        )}
      </div>
    </section>
  );
}
