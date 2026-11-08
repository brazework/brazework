"use server";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

export type TourState = { firstName: string; joinedAt: string; seen: string[] };

// What the tour needs to decide what to show: your first name, when you joined, and which
// tours and update notes you've already finished or closed (supabase/tours.sql: seen_tours).
// Returns null when signed out or when seen_tours can't be read, so nobody gets nagged.
export async function loadTourState(): Promise<TourState | null> {
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) return null;
  const { data, error } = await supabase.from("seen_tours").select("key").limit(500);
  if (error) return null;
  return {
    firstName: profile.first_name ?? "",
    joinedAt: profile.created_at ?? "",
    seen: (data ?? []).map((r: { key: string }) => r.key),
  };
}

const keysSchema = z.array(z.string().trim().min(1).max(80)).min(1).max(50);

// Finishing or closing a tour counts as seen, so it doesn't come back (on any device).
// Only `key` can be inserted; user_id defaults to auth.uid() and RLS checks it.
export async function markToursSeen(keys: string[]): Promise<{ ok: boolean; message: string }> {
  const parsed = keysSchema.safeParse([...new Set(keys)]);
  if (!parsed.success) return { ok: false, message: "Nothing to save." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase
    .from("seen_tours")
    .upsert(parsed.data.map((key) => ({ key })), { onConflict: "user_id,key", ignoreDuplicates: true });
  if (error) return { ok: false, message: friendlyError(error) };
  return { ok: true, message: "" };
}
