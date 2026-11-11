import { requestTime } from "@/lib/forge";
import { loadBuilds } from "@/lib/home-builds";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";
import { HomeHero } from "./home-hero";
import { YourBuilds } from "./your-builds";

// The top of Home (Linear FIX-67), for members past their first five minutes: where you are (the
// hero) and what you're building (your builds). Everything comes from the member's real rows.
export async function WeekLoop({ first }: { first: string }) {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const [loop, builds] = await Promise.all([loadLoop(supabase, user.id, requestTime()), loadBuilds(supabase, user.id)]);
  return (
    <>
      <HomeHero
        first={first}
        steps={loop.steps}
        streak={{ weeks: loop.streak.weeks, thisWeek: loop.streak.thisWeek }}
        recent={loop.recent}
        verified={loop.verified}
        viewers={loop.viewers}
        verifyQueue={loop.toVerify && loop.toVerify.n > 0 ? { href: `/c/${loop.toVerify.clubId}/manage?tab=verify`, n: loop.toVerify.n } : null}
      />
      {builds.length > 0 && <YourBuilds builds={builds} />}
    </>
  );
}
