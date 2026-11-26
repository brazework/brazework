"use server";
import { getViewer } from "@/lib/supabase/server";

// Torch's numbers (supabase/ember-card-counts.sql): what happened to one of its cards, counted for the
// signed-in member today. Numbers only, never what the card held. Called by the card once the server
// has answered (components/copilot/proposal-card.tsx). Counting never gets in the member's way: before
// the database step has run, or on any error, nothing happens.
export async function noteCardOutcome(what: "confirmed" | "dismissed" | "failed"): Promise<void> {
  if (what !== "confirmed" && what !== "dismissed" && what !== "failed") return;
  try {
    const { supabase, user } = await getViewer();
    if (!user) return;
    await supabase.rpc("ember_note", { p_what: what, p_n: 1 });
  } catch {
    /* counting is best-effort */
  }
}
