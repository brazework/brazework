"use server";
import { revalidatePath } from "next/cache";
import { checkBacking, recordBacking } from "@/lib/backing-check";
import { loadRecentWork } from "@/lib/recent-work-load";
import { ADD_MAX, addedMessage, workKey } from "@/lib/recent-work-pick";
import { getViewer } from "@/lib/supabase/server";

// "Add to my record" for the last 90 days of the member's own merged pull requests (the project page,
// lib/recent-work-pick.ts). Each one goes through the same check as backing a single milestone
// (lib/backing-check.ts: it's theirs, it's merged, the repo is linked), and is saved only if GitHub
// confirms it. Nothing the browser sends is trusted: the picks are matched against what the server
// itself would offer, and the title and date come from there.
// A pull request in a private repo is added hidden (only the member sees it), so confidential work
// never shows because of one tap; the member chooses to show it, as with any milestone.

export type RecentWorkResult = { ok: boolean; message: string; added: number };

export async function addRecentWork(projectId: string, picks: { repo: string; ref: string }[]): Promise<RecentWorkResult> {
  const none = (message: string): RecentWorkResult => ({ ok: false, message, added: 0 });
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(projectId) || !Array.isArray(picks)) return none("That project isn't yours.");
  const { supabase, user } = await getViewer();
  if (!user) return none("Log in again.");
  // What the server would offer right now; a pick that isn't in it is ignored.
  const offered = new Map((await loadRecentWork(projectId, user.id)).map((w) => [workKey(w.repo, w.ref), w]));
  const chosen = [...new Set(picks.filter((p) => p && typeof p.repo === "string" && typeof p.ref === "string").map((p) => workKey(p.repo, p.ref)))]
    .map((k) => offered.get(k)).filter((w) => !!w).slice(0, ADD_MAX);
  if (!chosen.length) return none(addedMessage({ added: 0, hidden: 0, skipped: 0 }));

  let added = 0, hidden = 0, skipped = 0;
  // A few at a time: each asks GitHub about the pull request and its reviews.
  for (let i = 0; i < chosen.length; i += 3) {
    await Promise.all(chosen.slice(i, i + 3).map(async (w) => {
      const backing = await checkBacking(w!.url, projectId, user.id);
      if (!backing.ok) { skipped++; return; }
      const row: Record<string, unknown> = { project_id: projectId, community_id: null, title: w!.title, detail: "", evidence: w!.url, achieved_on: w!.mergedOn, status: "logged" };
      // Shown only when the repo is public; a private repo's work stays the member's own until they show it.
      if (!backing.facts.repoPrivate) row.private = false;
      const { data: made, error } = await supabase.from("milestones").insert(row).select("id").single();
      if (error || !made) { skipped++; return; }
      if (!(await recordBacking(made.id as string, backing.facts))) {
        await supabase.from("milestones").delete().eq("id", made.id).eq("owner_id", user.id);
        skipped++;
        return;
      }
      added++;
      if (backing.facts.repoPrivate) hidden++;
    }));
  }
  if (added) { revalidatePath(`/projects/${projectId}`); revalidatePath(`/u/${user.id}`); }
  return { ok: added > 0, message: addedMessage({ added, hidden, skipped }), added };
}
