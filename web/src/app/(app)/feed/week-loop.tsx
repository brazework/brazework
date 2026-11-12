import { requestTime } from "@/lib/forge";
import { loadBuilds } from "@/lib/home-builds";
import { getViewer } from "@/lib/supabase/server";
import { loadLoop } from "@/lib/week-load";
import { YourWeekFold } from "./streak";
import { YourBuilds } from "./your-builds";

// The top of Home (Linear FIX-67, FIX-92), for members past their first five minutes. Your week tops
// the right rail; phones (no rail) get the same card above the composer, folded to one line.
export async function WeekLoop() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const loop = await loadLoop(supabase, user.id, requestTime());
  return <div className="xl:hidden"><YourWeekFold l={loop} /></div>;
}

// Your builds, under the composer: one tap to a reel or an update on each project.
export async function BuildsRow() {
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const builds = await loadBuilds(supabase, user.id);
  return builds.length > 0 ? <div className="mt-4"><YourBuilds builds={builds} /></div> : null;
}
