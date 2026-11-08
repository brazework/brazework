"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

export type ToggleResult = { ok: boolean; message: string };

const eventId = z.string().trim().min(1).max(64);

// Same tables and rules as public/js/events.js (setRsvp / setSaved). Row-level security only lets you
// RSVP to published events that aren't over, and only touch your own RSVPs and saves.
export async function toggleRsvp(id: string, going: boolean): Promise<ToggleResult> {
  const parsed = eventId.safeParse(id);
  if (!parsed.success) return { ok: false, message: "That event wasn't found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to RSVP." };
  const { error } = going
    ? await supabase.from("event_rsvps").insert({ event_id: parsed.data })
    : await supabase.from("event_rsvps").delete().eq("event_id", parsed.data).eq("user_id", user.id);
  // Already going (double click, or another tab) is fine.
  if (error && error.code !== "23505") {
    const msg = friendlyError(error);
    return { ok: false, message: msg === "You don't have permission to do that." ? "This event is over or was cancelled, so RSVPs are closed." : msg };
  }
  revalidatePath("/events", "layout");
  return { ok: true, message: "" };
}

export async function toggleSave(id: string, save: boolean): Promise<ToggleResult> {
  const parsed = eventId.safeParse(id);
  if (!parsed.success) return { ok: false, message: "That event wasn't found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to save events." };
  const { error } = save
    ? await supabase.from("event_saves").insert({ event_id: parsed.data })
    : await supabase.from("event_saves").delete().eq("event_id", parsed.data).eq("user_id", user.id);
  if (error && error.code !== "23505") return { ok: false, message: friendlyError(error) };
  revalidatePath("/events", "layout");
  return { ok: true, message: "" };
}
