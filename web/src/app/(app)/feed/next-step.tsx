import { ArrowRight, BadgeCheck, Compass } from "lucide-react";
import { NextStrip, nextButtonCls } from "@/components/app/next-strip";
import { ComposeLink } from "./compose-link";
import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";

// The one next step on Home (docs/design/app.md: one NextStrip per page). It is the weekly goal
// (lib/week.ts weekGoal): others waiting on you first, then what makes your work verifiable, then
// keeping your streak. Done for the week: one quiet line instead of a box. Before that, the
// first-five-minutes checklist sits in this same slot (start-checklist.tsx).
export async function NextStep() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { goal } = await loadLoop(supabase, user.id, requestTime());
  if (goal.done) {
    return (
      <section aria-label="Next step">
        <p className="flex items-center gap-2 px-1 text-sm text-text-2"><BadgeCheck className="size-4 shrink-0 text-ok" /> {goal.text}. Next week starts Monday.</p>
      </section>
    );
  }
  return (
    <NextStrip label="Next step" icon={<Compass />}
      action={<ComposeLink href={goal.href} className={nextButtonCls}>{goal.action || "Open"} <ArrowRight className="size-3.5" /></ComposeLink>}>
      {goal.text}
    </NextStrip>
  );
}
