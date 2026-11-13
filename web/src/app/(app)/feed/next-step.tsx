import { ArrowRight, Check } from "lucide-react";
import { ComposeLink } from "./compose-link";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";

// The first thing on Today once your first five minutes are done (redesign stage 1): the one action
// most worth taking this week, with one button. It is the weekly goal (lib/week.ts weekGoal): others
// waiting on you first, then what makes your work verifiable, then keeping your streak. Before that,
// the first-five-minutes checklist sits in this same slot (start-checklist.tsx).
export async function NextStep() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { goal } = await loadLoop(supabase, user.id, requestTime());
  if (goal.done) {
    return (
      <section aria-label="Next step" className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-text-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok text-white"><Check className="size-3" /></span>
        {goal.text}.
      </section>
    );
  }
  return (
    <section aria-label="Next step" className="glass-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl p-4 sm:p-5">
      <div className="min-w-0 flex-1 basis-56">
        <div className="text-[11px] font-medium tracking-wide text-faint uppercase">Next step</div>
        <p className="mt-0.5 text-[15px] font-semibold tracking-tight text-balance">{goal.text}</p>
      </div>
      <ComposeLink href={goal.href} className="bg-accent-grad inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-on-accent transition hover:opacity-90">
        {goal.action || "Open"} <ArrowRight className="size-4" />
      </ComposeLink>
    </section>
  );
}
