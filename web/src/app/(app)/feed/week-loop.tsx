import { requestTime } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";
import { LoopCard } from "./loop-card";

// The build loop at the top of Home (Linear FIX-67), for members past their first five minutes.
// Loads the member's real state; the interactive card is loop-card.tsx.
export async function WeekLoop() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { steps, streak, recent, toVerify } = await loadLoop(supabase, user.id, requestTime());
  return (
    <LoopCard
      steps={steps}
      streak={{ weeks: streak.weeks, thisWeek: streak.thisWeek }}
      recent={recent}
      verifyQueue={toVerify && toVerify.n > 0 ? { href: `/c/${toVerify.clubId}/manage?tab=verify`, n: toVerify.n } : null}
    />
  );
}
