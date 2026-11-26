"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// What Torch remembers (supabase/ember-memory.sql, Linear FIX-233): short things the member told Torch
// that carry over to the next chat. Saved only from a card the member confirms; listed in Settings,
// where each can be forgotten. Private to the member (row-level security).

export type Memory = { id: string; body: string; created_at: string };
export type MemoryState = { ok: boolean; message: string };

const body = z.string().trim().min(1, "Say what Torch should remember.").max(200, "Keep it under 200 characters.");

export async function rememberThis(text: string): Promise<MemoryState> {
  const v = body.safeParse(text);
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Check the text." };
  if (!(await dbFeatures()).emberMemory) return { ok: false, message: "Torch's memory isn't switched on yet." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("ember_memories").insert({ body: v.data });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : friendlyError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Torch will remember that." };
}

export async function forgetMemory(id: string): Promise<MemoryState> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "That memory couldn't be found." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("ember_memories").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath("/settings");
  return { ok: true, message: "Forgotten." };
}
